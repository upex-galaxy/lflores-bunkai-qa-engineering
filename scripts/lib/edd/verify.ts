import type { AttestedCheck } from './attest.ts';
import type { AgenticCheck, Depth, LoadedContract } from './contract.ts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { EVIDENCE_SUBJECT_PREFIX, looksLikeEvidence, readEvidenceMessage } from './attest.ts';
import { withReachedConfigs } from './configs.ts';
import { ALLOWED_SIGNERS, ALWAYS_GATE_KEYS, canonical, DEPTHS, gateKeysTouched, loadContract, PROJECT_YAML, readProjectDoc, refReader, sha256 } from './contract.ts';
import { changeDepth, depthRank, gatePathsTouched, globMatch, raiseForGateKeys, requiredAgentic } from './depth.ts';
import { changedFiles, commitMessage, EMPTY_TREE, git, mergeBase, parentsOf, rangeCount, rangeLog, showFile, treeOf } from './git.ts';
import { DiffTooLarge, MAX_DIFF_BYTES, patchId } from './patch-id.ts';
import { BOILERPLATE_REPO_IDS, BOILERPLATE_REPOS, listsASigner, listsOnlyMaintainer, MAINTAINER_KEYS, signerKeys, signersAt, signersEntry, SYMLINK_REFUSED } from './signers.ts';

export const MAX_COMMITS = 2000;

export type Signature = 'valid' | 'invalid' | 'absent';

export interface AgenticVerdict {
  ok: boolean
  required: string[]
  depth: Depth
  depthReasons: string[]
  patchId: string
  evidenceCommit: string | null
  signature: Signature
  signer: string | null
  checks: AttestedCheck[]
  problems: string[]
}

export interface VerifyInput {
  cwd: string
  base: string
  head: string
  loaded: LoadedContract
  allowedSigners: string | null
  untouchedCopy?: boolean
  signatureOf?: (sha: string) => { signature: Signature, signer: string | null }
  limits?: { commits?: number, diffBytes?: number }
}

function docAt(cwd: string, ref: string): Record<string, unknown> | null {
  try { return readProjectDoc(refReader(cwd, ref)); }
  catch { return null; }
}

export const RESOLVED_CONTRACT_KEY = 'evidence (resolved contract)';
const RUNNERS = new Set(['bun', 'npm', 'pnpm', 'yarn']);
const VALUE_FLAGS = new Set(['--filter', '-F', '--cwd', '--env-file', '--config', '-c', '--preload', '-r', '--prefix', '--workspace', '-w']);
const NPM_SHORT = new Set(['test', 'start', 'stop', 'restart']);
const MAX_SCRIPTS = 200;

export interface ScriptRefs { names: string[], opaque: boolean }

function shellCommands(text: string): string[][] {
  const out: string[][] = [];
  let words: string[] = [];
  let word = '';
  let has = false;
  let quote: string | null = null;
  const endWord = (): void => {
    if (has) { words.push(word); }
    word = '';
    has = false;
  };
  const endCommand = (): void => {
    endWord();
    if (words.length > 0) { out.push(words); }
    words = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== null) {
      if (ch === quote) { quote = null; }
      else if (ch === '\\' && quote === '"' && i + 1 < text.length) { word += text[++i]; }
      else { word += ch; }
    }
    else if (ch === '\'' || ch === '"') { quote = ch; has = true; }
    else if (ch === '\\' && i + 1 < text.length) { word += text[++i]; has = true; }
    else if (ch === '\n' || ';&|()'.includes(ch)) { endCommand(); }
    else if (/\s/.test(ch)) { endWord(); }
    else { word += ch; has = true; }
  }
  endCommand();
  return out;
}

function commandRefs(words: string[], depth: number): ScriptRefs {
  const none: ScriptRefs = { names: [], opaque: false };
  let i = 0;
  while (i < words.length && (words[i] === 'env' || /^\w+=/.test(words[i]))) { i++; }
  const cmd = words[i];
  if (cmd === undefined) { return none; }
  if (['sh', 'bash', 'zsh'].includes(cmd) && words[i + 1] === '-c' && words[i + 2] !== undefined) {
    return depth < 3 ? scriptRefs(words[i + 2], depth + 1) : { names: [], opaque: true };
  }
  if (/[$`]/.test(cmd)) { return { names: [], opaque: true }; }
  const runner = cmd.split('/').pop() ?? cmd;
  if (!RUNNERS.has(runner)) { return none; }
  i++;
  const skipFlags = (): void => {
    while (i < words.length && words[i].startsWith('-')) { i += VALUE_FLAGS.has(words[i]) ? 2 : 1; }
  };
  skipFlags();
  const explicit = words[i] === 'run' || words[i] === 'run-script';
  if (explicit) {
    i++;
    skipFlags();
  }
  const name = words[i];
  if (name === undefined) { return none; }
  if (/[$`]/.test(name)) { return { names: [], opaque: true }; }
  if (runner === 'npm' && !explicit) { return NPM_SHORT.has(name) ? { names: [name], opaque: false } : none; }
  if (runner === 'bun' && !explicit && (name === 'x' || name === 'exec')) { return none; }
  return { names: [name], opaque: false };
}

export function scriptRefs(text: string, depth = 0): ScriptRefs {
  const refs = shellCommands(text).map(w => commandRefs(w, depth));
  return { names: [...new Set(refs.flatMap(r => r.names))], opaque: refs.some(r => r.opaque) };
}

export function reachedScripts(cmds: string[], ...scripts: (Record<string, unknown> | null)[]): ScriptRefs {
  const seen = new Set<string>();
  const first = cmds.map(c => scriptRefs(c));
  const queue = first.flatMap(r => r.names);
  let opaque = first.some(r => r.opaque);
  while (queue.length > 0) {
    if (seen.size >= MAX_SCRIPTS) {
      opaque = true;
      break;
    }
    const name = queue.shift()!;
    if (seen.has(name)) { continue; }
    seen.add(name);
    for (const body of scripts.map(s => s?.[name]).filter((v): v is string => typeof v === 'string')) {
      const r = scriptRefs(body);
      queue.push(...r.names);
      opaque ||= r.opaque;
    }
  }
  return { names: [...seen], opaque };
}

export const OPAQUE_SCRIPTS_KEY = 'package.json scripts (a reached script runs a script whose name cannot be read)';

function scriptsAt(cwd: string, ref: string): Record<string, unknown> | null {
  const raw = showFile(cwd, ref, 'package.json');
  if (raw === null) { return {}; }
  try {
    const scripts = (JSON.parse(raw) as { scripts?: unknown } | null)?.scripts;
    return scripts !== null && typeof scripts === 'object' && !Array.isArray(scripts) ? scripts as Record<string, unknown> : {};
  }
  catch { return null; }
}

const TOOL_CONFIG_KEYS = ['prettier', 'eslintConfig'];

function packageAt(cwd: string, ref: string, path: string): Record<string, unknown> | null {
  const raw = showFile(cwd, ref, path);
  if (raw === null) { return {}; }
  try {
    const pkg = (path.endsWith('.yaml') ? parseYaml(raw) : JSON.parse(raw)) as unknown;
    return pkg !== null && typeof pkg === 'object' && !Array.isArray(pkg) ? pkg as Record<string, unknown> : {};
  }
  catch { return null; }
}

function scriptValue(scripts: Record<string, unknown> | null, name: string): string {
  return scripts === null ? 'unreadable package.json' : canonical(scripts[name]);
}

function digestAt(cwd: string, ref: string): string | null {
  try { return loadContract(refReader(cwd, ref), ref).digest; }
  catch { return null; }
}

export function gateKeysChanged(cwd: string, base: string, head: string, loaded: LoadedContract): string[] {
  const fork = base === EMPTY_TREE ? null : mergeBase(cwd, base, head) ?? base;
  const keys = gateKeysTouched(fork === null ? loaded.doc : docAt(cwd, fork), docAt(cwd, head), [...new Set([...ALWAYS_GATE_KEYS, ...loaded.contract.human.keys])]);
  if (fork === null) { return keys; }
  if (!keys.includes('evidence')) {
    const before = digestAt(cwd, fork);
    if (before === null || before !== digestAt(cwd, head)) { keys.push(RESOLVED_CONTRACT_KEY); }
  }
  const before = scriptsAt(cwd, fork);
  const after = scriptsAt(cwd, head);
  const reach = reachedScripts(loaded.contract.static.map(s => s.cmd), before, after);
  for (const name of reach.names) {
    if (scriptValue(before, name) !== scriptValue(after, name)) { keys.push(`package.json scripts.${name}`); }
  }
  if (reach.opaque && canonical(before) !== canonical(after)) { keys.push(OPAQUE_SCRIPTS_KEY); }
  for (const path of changedFiles(cwd, fork, head).filter(f => /(?:^|\/)package\.(?:json|yaml)$/.test(f))) {
    const was = packageAt(cwd, fork, path);
    const now = packageAt(cwd, head, path);
    for (const key of TOOL_CONFIG_KEYS) {
      if (was === null || now === null ? was !== now : canonical(was[key]) !== canonical(now[key])) { keys.push(`${path} ${key}`); }
    }
  }
  return keys;
}

export const GATE_REVIEW: AgenticCheck = { id: 'gate-review', kind: 'review', tool: null, envs: ['local'], min_depth: 'standard' };

function keyFile(key: string): string {
  if (key.startsWith('package.json ')) { return 'package.json'; }
  const own = key.match(/^(\S*package\.(?:json|yaml)) (?:prettier|eslintConfig)$/);
  return own ? own[1] : PROJECT_YAML;
}

export interface Requirement { depth: Depth, reasons: string[], files: string[], required: AgenticCheck[] }

export function changeDepthWithKeys(cwd: string, base: string, files: string[], head: string, loaded: LoadedContract, raise: Depth | null = null): Requirement {
  const reach = withReachedConfigs(cwd, base, head, files);
  const keys = gateKeysChanged(cwd, base, head, loaded);
  const gatePaths = gatePathsTouched(reach.files, loaded.contract.human.paths);
  const d = raiseForGateKeys(changeDepth(reach.files, loaded.contract.depth, raise), keys);
  let depth = d.depth;
  const reasons = [...d.reasons, ...reach.reasons];
  const { agentic } = loaded.contract;
  let required = requiredAgentic(agentic, depth, reach.files);
  const gateFiles = [...new Set([...gatePaths, ...keys.map(keyFile)])];
  const uncovered = gateFiles.filter(f => !required.some(c => !c.paths || c.paths.some(p => globMatch(p, f))));
  if (uncovered.length > 0) {
    if (depthRank(depth) < depthRank('standard')) { depth = 'standard'; }
    if (agentic.length > 0) {
      required = [...required, ...agentic.filter(c => !required.includes(c))];
      reasons.push(`no agentic check of the base contract covers the gate change (${uncovered.slice(0, 5).join(', ')}), so every agentic check it declares applies`);
    }
    else {
      required = [GATE_REVIEW];
      reasons.push(`the base contract declares no agentic check, so the gate change (${uncovered.slice(0, 5).join(', ')}) needs the built-in ${GATE_REVIEW.id} check: a tester's verdict on the change itself`);
    }
  }
  return { depth, reasons, files: reach.files, required };
}

export function isEvidenceCommit(cwd: string, sha: string): boolean {
  return looksLikeEvidence(commitMessage(cwd, sha));
}

export function findEvidenceCommit(cwd: string, base: string, head: string): string | null {
  return rangeLog(cwd, base, head).find(c => looksLikeEvidence(c.subject))?.sha ?? null;
}

export interface Authors { sessions: string[], unlabeled: string[] }

export function authorSessions(cwd: string, base: string, head: string): Authors {
  const s = new Set<string>();
  const unlabeled: string[] = [];
  for (const c of rangeLog(cwd, base, head)) {
    if (looksLikeEvidence(c.subject)) { continue; }
    const known = c.sessions.filter(v => v && v !== 'unknown');
    if (known.length === 0) { unlabeled.push(c.sha); }
    for (const v of known) { s.add(v); }
  }
  return { sessions: [...s], unlabeled };
}

export function sameSession(verdictBy: string, session: string): boolean {
  return verdictBy.trim().toLowerCase() === session.trim().toLowerCase();
}

export function testerProblems(checks: AttestedCheck[], authors: Authors, depth: Depth): string[] {
  if (depthRank(depth) < depthRank('standard') || checks.length === 0) { return []; }
  const out = authors.unlabeled.map(c => `code commit ${c.slice(0, 12)} has no Session trailer: at depth ${depth} the tester must be provably another session`);
  return [...out, ...checks.flatMap(c => authors.sessions.filter(s => sameSession(c.verdict_by, s)).map(s => `${c.id}/${c.env}: verdict_by "${c.verdict_by}" is the author session ${s}; at depth ${depth} the tester must be another session`))];
}

export function coverageProblems(required: AgenticCheck[], checks: AttestedCheck[], depth: Depth): string[] {
  const out: string[] = [];
  for (const r of required) {
    const mine = checks.filter(c => c.id === r.id);
    if (mine.length === 0) { out.push(`${r.id}: required at depth ${depth}, not attested`); continue; }
    for (const c of mine) {
      if (c.verdict !== 'pass') { out.push(`${r.id}/${c.env}: verdict ${c.verdict}`); }
      if (!Array.isArray(c.artifacts) || c.artifacts.length === 0) { out.push(`${r.id}/${c.env}: no artifacts listed`); }
      if (!r.envs.includes(c.env)) { out.push(`${r.id}/${c.env}: env is not one of ${r.envs.join(', ')}`); }
    }
    const wanted = depth === 'deep' ? r.envs : [];
    for (const env of wanted) {
      if (!mine.some(c => c.env === env && c.verdict === 'pass')) { out.push(`${r.id}: depth deep needs a pass on ${env}`); }
    }
  }
  return out;
}

export function checkSignature(cwd: string, sha: string, allowedSigners: string | null): { signature: Signature, signer: string | null } {
  if (allowedSigners === null || allowedSigners.trim() === '') { return { signature: 'invalid', signer: null }; }
  const dir = mkdtempSync(join(tmpdir(), 'edd-signers-'));
  try {
    const file = join(dir, 'allowed_signers');
    writeFileSync(file, allowedSigners);
    const r = git(cwd, ['-c', `gpg.ssh.allowedSignersFile=${file}`, '-c', 'gpg.openpgp.program=false', '-c', 'gpg.x509.program=false', 'log', '-1', '--format=%G?%x00%GF', sha]);
    const [status, fp] = r.out.trim().split('\0');
    if (r.code !== 0) { return { signature: 'invalid', signer: null }; }
    if (status === 'N') { return { signature: 'absent', signer: null }; }
    return { signature: status === 'G' ? 'valid' : 'invalid', signer: fp || null };
  }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

export function untouchedCopy(cwd: string, ref: string, slug: string | null, repoId: number | null = null): boolean {
  if (slug !== null && BOILERPLATE_REPOS.includes(slug.toLowerCase())) { return false; }
  if (repoId !== null && BOILERPLATE_REPO_IDS.includes(repoId)) { return false; }
  if (!listsOnlyMaintainer(signersAt(cwd, ref))) { return false; }
  const versions = git(cwd, ['log', '--full-history', '--format=%H', ref, '--', ALLOWED_SIGNERS]).out.split('\n').map(s => s.trim()).filter(Boolean);
  if (versions.length > MAX_COMMITS) { return false; }
  for (const sha of versions) {
    const text = signersAt(cwd, sha);
    if (text !== null && signerKeys(text).some(k => !MAINTAINER_KEYS.includes(k))) { return false; }
  }
  const maintainers = `${MAINTAINER_KEYS.map(k => `maintainer namespaces="git" ${k}`).join('\n')}\n`;
  const evidence = git(cwd, ['log', '--format=%H%x00%s', '--fixed-strings', `--grep=${EVIDENCE_SUBJECT_PREFIX}`, ref]).out.split('\n').map(l => l.split('\0')).filter(([sha, subject]) => sha && looksLikeEvidence(subject ?? ''));
  if (evidence.length > MAX_COMMITS) { return false; }
  return evidence.every(([sha]) => checkSignature(cwd, sha, maintainers).signature === 'valid');
}

function refused(problem: string): AgenticVerdict {
  return { ok: false, required: [], depth: 'none', depthReasons: [], patchId: 'unknown', evidenceCommit: null, signature: 'absent', signer: null, checks: [], problems: [problem] };
}

export function verifyAgentic(input: VerifyInput): AgenticVerdict {
  const { cwd, base, head, loaded } = input;
  const maxCommits = input.limits?.commits ?? MAX_COMMITS;
  const count = rangeCount(cwd, base, head);
  if (count > maxCommits) { return refused(`the range has ${count} commits, over the ${maxCommits}-commit cap: verification refused, split the change`); }
  let pid: string;
  try { pid = patchId(cwd, base, head, input.limits?.diffBytes ?? MAX_DIFF_BYTES); }
  catch (e) {
    if (e instanceof DiffTooLarge) { return refused(`${e.message}; verification refused`); }
    throw e;
  }
  const copy = input.untouchedCopy === true && listsOnlyMaintainer(input.allowedSigners);
  const baseHasSigner = input.allowedSigners !== null && listsASigner(input.allowedSigners) && !copy;
  const headSigners = baseHasSigner ? null : signersAt(cwd, head);
  const firstSigner = headSigners !== null && listsASigner(headSigners);
  const files = changedFiles(cwd, base, head).filter(f => !(firstSigner && f === ALLOWED_SIGNERS));
  const keyed = changeDepthWithKeys(cwd, base, files, head, loaded);
  const depth = keyed.depth;
  const reasons = firstSigner ? [...keyed.reasons, copy ? `${ALLOWED_SIGNERS} gets a first signer of its own while the base lists only the boilerplate maintainer's key and the copy never delivered under evidence: the file itself needs no signed evidence (trusted on first use)` : `${ALLOWED_SIGNERS} gets its first signer while the base lists none: the file itself needs no signed evidence (trusted on first use)`] : keyed.reasons;
  const required = keyed.required;
  const verdict: AgenticVerdict = { ok: true, required: required.map(r => r.id), depth, depthReasons: reasons, patchId: pid, evidenceCommit: null, signature: 'absent', signer: null, checks: [], problems: [] };
  if (files.includes(ALLOWED_SIGNERS) && signersEntry(cwd, head) === 'symlink') { verdict.problems.push(SYMLINK_REFUSED); verdict.ok = false; }
  const evidence = findEvidenceCommit(cwd, base, head);
  if (required.length === 0 && evidence === null) { return verdict; }
  if (!verdict.ok) { return verdict; }
  const problems = verdict.problems;
  if (evidence === null) {
    problems.push(`depth ${depth} requires agentic evidence (${verdict.required.join(', ')}) and no evidence commit is in the range: run bun run edd attest`);
    verdict.ok = false;
    return verdict;
  }
  verdict.evidenceCommit = evidence;
  const read = readEvidenceMessage(commitMessage(cwd, evidence));
  if (!read.ok) { problems.push(`${evidence.slice(0, 12)}: ${read.problem}`); verdict.ok = false; return verdict; }
  const parsed = read.evidence;
  const { payload } = parsed;
  verdict.checks = payload.checks;
  const parents = parentsOf(cwd, evidence);
  if (parents.length !== 1) { problems.push('the evidence commit must have exactly one parent'); }
  else if (treeOf(cwd, evidence) !== treeOf(cwd, parents[0])) { problems.push('the evidence commit is not empty: it changes the tree'); }
  if (parsed.digest !== `sha256:${sha256(parsed.line)}`) { problems.push('Evidence-Digest does not match the attested JSON line'); }
  if (parsed.patchId !== payload.patch_id) { problems.push('Evidence-Patch-Id trailer and the attested patch_id differ'); }
  if (parsed.subject !== payload.subject) { problems.push('Evidence-Subject trailer and the attested subject differ'); }
  if (payload.patch_id !== pid) {
    problems.push(`the change's patch id is ${pid}, the evidence attests ${payload.patch_id}: the diff changed after attest, re-attest`);
  }
  const sig = input.signatureOf ? input.signatureOf(evidence) : checkSignature(cwd, evidence, input.allowedSigners);
  verdict.signature = sig.signature;
  verdict.signer = sig.signer;
  if (sig.signature !== 'valid') { problems.push(`evidence commit signature is ${sig.signature} against the allowed signers read from the base${baseHasSigner ? '' : `; the base lists no valid signer line, so seat one first: run bun run edd signers and push ${ALLOWED_SIGNERS} in a change of its own`}`); }
  if (payload.contract_digest !== loaded.digest) { problems.push(`the evidence was attested against contract ${payload.contract_digest}; the base contract is ${loaded.digest}: re-attest`); }
  if (!(DEPTHS as readonly string[]).includes(payload.depth) || depthRank(payload.depth) < depthRank(depth)) { problems.push(`attested depth ${payload.depth} is below the change's depth ${depth}`); }
  problems.push(...coverageProblems(required, payload.checks, depth));
  problems.push(...testerProblems(payload.checks, authorSessions(cwd, base, parents[0] ?? head), depth));
  verdict.ok = problems.length === 0;
  return verdict;
}
