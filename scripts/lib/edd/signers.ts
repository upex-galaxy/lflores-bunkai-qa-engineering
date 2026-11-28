import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';

import { ALLOWED_SIGNERS } from './contract.ts';
import { git, primaryRoot, showFile } from './git.ts';

export const SIGNERS_HEADER = [
  '# Public SSH keys whose signature the EDD verifier accepts on an evidence commit',
  '# (gpg.ssh.allowedSignersFile format: principal, namespaces, key). The verifier',
  '# reads this file from the BASE ref, so a pull request cannot add its own key once one is listed.',
  '# Public keys only. Add a signer by appending one line in a reviewed change.',
];

export const NO_SIGNING_KEY = [
  'No SSH signing key is configured in git, so no signer was written to .agents/edd/allowed_signers.',
  'Configure one, then run bun run edd signers:',
  '  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519          (only if you have no SSH key yet)',
  '  git config --global gpg.format ssh',
  '  git config --global user.signingkey ~/.ssh/id_ed25519.pub',
  '  git config --global commit.gpgsign true',
  'Until a signer is listed, a change that needs agentic evidence cannot pass the evidence gate.',
].join('\n');

export interface SignerSeed { status: 'written' | 'kept' | 'no-key' | 'refused', message: string }

function expandHome(p: string, home: string): string {
  return p === '~' ? home : p.startsWith('~/') ? join(home, p.slice(2)) : p;
}

export function signingKey(cwd: string, home = homedir()): { key: string, from: string } | null {
  const format = git(cwd, ['config', '--get', 'gpg.format']).out.trim();
  const raw = git(cwd, ['config', '--get', 'user.signingkey']).out.trim();
  if (format !== 'ssh' || raw === '') { return null; }
  const literal = raw.startsWith('key::') ? raw.slice(5) : raw;
  if (/^(?:ssh-|ecdsa-|sk-)\S+ \S+/.test(literal)) { return { key: literal.split(/\s+/).slice(0, 2).join(' '), from: 'the key literal in user.signingkey' }; }
  const path = expandHome(literal, home);
  const full = isAbsolute(path) ? path : join(cwd, path);
  const pub = full.endsWith('.pub') ? full : `${full}.pub`;
  if (!existsSync(pub)) { return null; }
  const fields = readFileSync(pub, 'utf8').trim().split(/\s+/);
  return fields.length >= 2 && /^(?:ssh-|ecdsa-|sk-)/.test(fields[0]) ? { key: `${fields[0]} ${fields[1]}`, from: pub } : null;
}

export function signingPublicKey(cwd: string, home = homedir()): string | null {
  return signingKey(cwd, home)?.key ?? null;
}

const KEY_TYPE = /^(?:ssh-[a-z0-9-]+|ecdsa-sha2-[a-z0-9-]+|sk-[a-z0-9@.-]+)$/;

function keyBlob(type: string, b64: string): Buffer | null {
  if (!KEY_TYPE.test(type) || !/^[A-Z0-9+/]+={0,2}$/i.test(b64)) { return null; }
  const blob = Buffer.from(b64, 'base64');
  const fields: Buffer[] = [];
  for (let at = 0; at < blob.length;) {
    if (at + 4 > blob.length) { return null; }
    const n = blob.readUInt32BE(at);
    if (at + 4 + n > blob.length) { return null; }
    fields.push(blob.subarray(at + 4, at + 4 + n));
    at += 4 + n;
  }
  if (fields.length < 2 || fields[0].toString('latin1') !== type || fields.slice(1).some(f => f.length === 0)) { return null; }
  return type.includes('ed25519') && fields[1].length !== 32 ? null : blob;
}

export function fingerprint(key: string): string | null {
  const [type = '', b64 = ''] = key.trim().split(/\s+/);
  const blob = keyBlob(type, b64);
  return blob === null ? null : `SHA256:${createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')}`;
}

function lineKey(line: string): string | null {
  const t = line.trim();
  if (t === '' || t.startsWith('#')) { return null; }
  const f = t.split(/\s+/);
  for (let i = 1; i + 1 < f.length; i++) {
    if (keyBlob(f[i], f[i + 1]) !== null) { return `${f[i]} ${f[i + 1]}`; }
  }
  return null;
}

export function signerLine(line: string): boolean {
  return lineKey(line) !== null;
}

export function signerKeys(text: string): string[] {
  return text.split('\n').map(lineKey).filter((k): k is string => k !== null);
}

export const BOILERPLATE_REPOS = ['upex-galaxy/agentic-qa-boilerplate', 'upex-galaxy/agentic-dev-boilerplate'];
export const BOILERPLATE_REPO_IDS = [1211207463, 1234288216];
export const MAINTAINER_KEYS = ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIInZZXBSD8v49PZrtNF+KiooYml3r99AVGQgmA0ZvLf+'];

export function listsOnlyMaintainer(text: string | null): boolean {
  const keys = text === null ? [] : signerKeys(text);
  return keys.length > 0 && keys.every(k => MAINTAINER_KEYS.includes(k));
}

export const SEAT_SUBJECT = 'chore(edd): seat the project signer in place of the boilerplate maintainer key';

export function sessionIdentity(root: string, env: Record<string, string | undefined> = process.env): { worktree: string, session: string } | null {
  const session = env.EDD_SESSION?.trim();
  if (!session || session === 'unknown') { return null; }
  const worktree = env.EDD_WORKTREE?.trim() || (primaryRoot(root) === root ? 'primary' : basename(root));
  return { worktree, session };
}

function trailerValue(v: string): string {
  return v.split(/[\r\n]/)[0].trim();
}

export function seatMessage(given: { worktree: string, session: string } | null): string {
  const id = given && trailerValue(given.session) && trailerValue(given.session) !== 'unknown' ? { worktree: trailerValue(given.worktree) || 'unknown', session: trailerValue(given.session) } : null;
  const body = `This commit seats the first signer of this project: ${ALLOWED_SIGNERS} now lists the installing user's signing key in place of the boilerplate maintainer's key. The copy never delivered under evidence, so the gate trusts this signer on first use.`;
  return `${[SEAT_SUBJECT, '', body, ...(id ? ['', `Worktree: ${id.worktree}`, `Session: ${id.session}`] : [])].join('\n')}\n`;
}

export function commitSigners(root: string, id: { worktree: string, session: string } | null = sessionIdentity(root)): string | null {
  if (git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).code !== 0) { return null; }
  const r = git(root, ['commit', '--only', '-q', '-F', '-', '--', ALLOWED_SIGNERS], seatMessage(id));
  return r.code === 0 ? git(root, ['rev-parse', 'HEAD']).out.trim() : null;
}

export function listsASigner(text: string): boolean {
  return text.split('\n').some(signerLine);
}

export function signersEntry(cwd: string, ref: string): 'file' | 'symlink' | 'absent' {
  const entry = git(cwd, ['ls-tree', ref, '--', ALLOWED_SIGNERS]).out.trim();
  return entry === '' ? 'absent' : entry.startsWith('120000 ') ? 'symlink' : 'file';
}

export function signersAt(cwd: string, ref: string): string | null {
  return signersEntry(cwd, ref) === 'file' ? showFile(cwd, ref, ALLOWED_SIGNERS) : null;
}

export const SYMLINK_REFUSED = `${ALLOWED_SIGNERS} is a symlink. The verifier never follows one, so it lists no signer. Replace it with a regular file: git rm ${ALLOWED_SIGNERS}, run bun run edd signers, and commit the file it writes in a change of its own.`;

function isSymlink(path: string): boolean {
  try { return lstatSync(path).isSymbolicLink(); }
  catch { return false; }
}

export function seedWarns(seed: SignerSeed): boolean {
  return seed.status === 'no-key' || seed.status === 'refused';
}

export function seedAllowedSigners(root: string, opts: { replace?: boolean, copy?: boolean, home?: string } = {}): SignerSeed {
  const file = join(root, ALLOWED_SIGNERS);
  if (isSymlink(file)) { return { status: 'refused', message: SYMLINK_REFUSED }; }
  if (!opts.replace && existsSync(file) && listsASigner(readFileSync(file, 'utf8'))) {
    return { status: 'kept', message: `${ALLOWED_SIGNERS} already lists a signer; it was left as it is.` };
  }
  const replaced = existsSync(file) && listsASigner(readFileSync(file, 'utf8'));
  const found = signingKey(root, opts.home);
  if (found === null) { return { status: 'no-key', message: NO_SIGNING_KEY }; }
  const { key } = found;
  const principal = git(root, ['config', '--get', 'user.email']).out.trim() || 'signer';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${[...SIGNERS_HEADER, `${principal} namespaces="git" ${key}`].join('\n')}\n`);
  const which = `${principal}, ${fingerprint(key) ?? key.split(' ')[0]}, read from ${found.from}`;
  if (replaced && opts.copy) {
    return { status: 'written', message: `${ALLOWED_SIGNERS} now lists your signing key (${which}) in place of the boilerplate maintainer's key this copy carried. The copy never delivered under evidence, so the gate trusts this first signer of its own on first use: push its commit alone.` };
  }
  if (replaced) {
    return { status: 'written', message: `${ALLOWED_SIGNERS} now lists your signing key (${which}) in place of the signer it held. The evidence gate reads signers from the base, which still lists the old one, so it refuses this change while it needs evidence signed by a listed key; a copy of the template has no such key.` };
  }
  return { status: 'written', message: `${ALLOWED_SIGNERS} now lists your signing key (${which}). It is the first signer, trusted on first use: commit it in a change of its own, and later signers are added by a change signed with a key already listed.` };
}
