import { posix } from 'node:path';

import { globMatch } from './depth.ts';
import { git, showFile } from './git.ts';

const TOOL_CONFIGS = ['**/tsconfig*.json', '**/.oxlintrc*.json', '**/eslint.config*', '**/.prettierrc*', '**/prettier.config.*'];
const MAX_REACHED = 2000;
const JSON_EXTENDS = /"extends"\s*:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\])/g;
const JSON_STRING = /"((?:[^"\\]|\\.)*)"/g;
const WHOLE_STRING = /^\s*(["'])(\.{1,2}\/[^"']+)\1\s*$/;
const JS_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"`])(\.{1,2}\/[^'"`]+)\1/g;
const JSON_SUFFIXES = ['', '.json', '/tsconfig.json'];
const JS_SUFFIXES = ['', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.json', '/index.js', '/index.mjs', '/index.cjs', '/index.ts'];
const SCRIPT = /\.(?:[cm]?js|[cm]?ts)$/;

interface Tree { files: Set<string>, links: Map<string, string> }

function inModules(path: string): boolean {
  return path.split('/').includes('node_modules');
}

function inside(joined: string): boolean {
  return !(joined.startsWith('../') || joined === '..' || joined.startsWith('/') || inModules(joined));
}

function listTree(cwd: string, ref: string): Tree {
  const files = new Set<string>();
  const links = new Map<string, string>();
  for (const entry of git(cwd, ['ls-tree', '-r', '-z', ref]).out.split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t');
    const path = entry.slice(tab + 1);
    files.add(path);
    if (entry.startsWith('120000 ')) {
      const target = showFile(cwd, ref, path);
      const joined = target === null ? null : posix.normalize(posix.join(posix.dirname(path), target.trim()));
      if (joined !== null && inside(joined)) { links.set(path, joined); }
    }
  }
  return { files, links };
}

function resolveIn(tree: Tree, from: string, spec: string, suffixes: string[]): string | null {
  const joined = posix.normalize(posix.join(posix.dirname(from), spec)).replace(/\/+$/, '');
  if (!inside(joined)) { return null; }
  return suffixes.map(s => `${joined}${s}`).find(p => tree.files.has(p)) ?? null;
}

function stripComments(text: string): string {
  return text.replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, m => (m.startsWith('"') ? m : ' '));
}

function decode(raw: string): string {
  try { return JSON.parse(`"${raw}"`) as string; }
  catch { return raw; }
}

function references(path: string, text: string, tree: Tree): string[] {
  const whole = text.match(WHOLE_STRING);
  if (whole) { return [resolveIn(tree, path, whole[2], JSON_SUFFIXES)].filter((p): p is string => p !== null); }
  if (SCRIPT.test(path)) {
    return [...text.matchAll(JS_IMPORT)].map(m => resolveIn(tree, path, m[2], JS_SUFFIXES)).filter((p): p is string => p !== null);
  }
  const specs = [...stripComments(text).matchAll(JSON_EXTENDS)].flatMap(m => [...m[1].matchAll(JSON_STRING)].map(s => decode(s[1])));
  return specs.filter(s => s.startsWith('.')).map(s => resolveIn(tree, path, s, JSON_SUFFIXES)).filter((p): p is string => p !== null);
}

export interface Reach { reached: Map<string, string>, overflow: string | null }

export function reachedConfigs(cwd: string, ref: string): Reach {
  const tree = listTree(cwd, ref);
  const reached = new Map<string, string>();
  for (const root of [...tree.files].filter(f => !inModules(f) && TOOL_CONFIGS.some(g => globMatch(g, f)))) {
    const seen = new Set([root]);
    const queue = [root];
    while (queue.length > 0) {
      if (seen.size > MAX_REACHED) { return { reached, overflow: root }; }
      const path = queue.shift()!;
      const link = tree.links.get(path);
      const text = link === undefined ? showFile(cwd, ref, path) : null;
      const next = link === undefined ? (text === null ? [] : references(path, text, tree)) : [link];
      for (const n of next) {
        if (seen.has(n)) { continue; }
        seen.add(n);
        queue.push(n);
        if (n !== root && !reached.has(n)) { reached.set(n, root); }
      }
    }
  }
  return { reached, overflow: null };
}

export function withReachedConfigs(cwd: string, base: string, head: string, files: string[]): { files: string[], reasons: string[] } {
  const reaches = [reachedConfigs(cwd, base), reachedConfigs(cwd, head)];
  const out = [...files];
  const reasons: string[] = [];
  const overflow = reaches.map(r => r.overflow).find((o): o is string => o !== null);
  for (const file of files) {
    const root = overflow ?? reaches.map(r => r.reached.get(file)).find((r): r is string => r !== undefined);
    if (root === undefined) { continue; }
    reasons.push(overflow ? `the tool config ${overflow} reaches more than ${MAX_REACHED} files, so every changed file takes its depth and checks` : `${file} is reached from the tool config ${root} through extends or an import, so it takes the depth and checks of ${root}`);
    if (!out.includes(root)) { out.push(root); }
  }
  return { files: out, reasons: [...new Set(reasons)] };
}
