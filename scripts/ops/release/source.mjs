import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const HASH = /^[a-f0-9]{64}$/;
export const REVISION = /^[a-f0-9]{40}$/;
export const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;

export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  requireValue(value === null || ['string', 'boolean'].includes(typeof value)
    || (typeof value === 'number' && Number.isFinite(value)), 'Non-JSON value in release evidence');
  return JSON.stringify(value);
}

export const hashJson = value => sha256(canonical(value));

export function safeSourcePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length < 1024
    && !/[\\\x00-\x1f:]/.test(value) && !value.startsWith('/')
    && value.split('/').every(part => part && part !== '.' && part !== '..' && part !== '.git');
}

function sourceFile(root, name) {
  requireValue(safeSourcePath(name), 'Unsafe source path');
  let current = root;
  const parts = name.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = lstatSync(current);
    requireValue(!stat.isSymbolicLink(), `Symlink in release source: ${name}`);
    requireValue(index === parts.length - 1 ? stat.isFile() : stat.isDirectory(), `Invalid source file: ${name}`);
  }
  return current;
}

export function validateSnapshot(snapshot) {
  requireValue(snapshot && REVISION.test(snapshot.revision), 'Missing source revision');
  requireValue(Array.isArray(snapshot.files) && snapshot.files.length > 0 && snapshot.files.length <= 20_000, 'Empty or invalid source inventory');
  let previous = '';
  for (const file of snapshot.files) {
    requireValue(file && safeSourcePath(file.path) && file.path > previous, 'Unsafe, duplicate or unsorted source inventory');
    requireValue(['100644', '100755'].includes(file.mode) && HASH.test(file.sha256), 'Invalid source entry');
    previous = file.path;
  }
  requireValue(snapshot.fingerprint === hashJson({ revision: snapshot.revision, files: snapshot.files }), 'Source fingerprint mismatch');
  return snapshot;
}

/** Reads only tracked files; ignored local env and dependency directories never enter the inventory. */
export function captureGitSource(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const revision = git('rev-parse', 'HEAD').trim();
  const files = git('ls-files', '--stage', '-z').split('\0').filter(Boolean).map(entry => {
    const match = /^(\d{6}) [a-f0-9]+ 0\t(.+)$/s.exec(entry);
    requireValue(match && ['100644', '100755'].includes(match[1]), 'Unmerged, symlink or unsupported source entry');
    return { path: match[2], mode: match[1], sha256: sha256(readFileSync(sourceFile(root, match[2]))) };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return validateSnapshot({ revision, files, fingerprint: hashJson({ revision, files }) });
}

/** The build context must be a pristine archive, not a working checkout with ignored local files. */
export function verifySourceArchive(root, snapshot) {
  validateSnapshot(snapshot);
  const actual = [];
  const directories = new Set(snapshot.files.flatMap(file => {
    const parts = file.path.split('/');
    return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
  }));
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      requireValue(safeSourcePath(name), 'Unsafe archive path');
      requireValue(!entry.isSymbolicLink(), `Symlink in source archive: ${name}`);
      if (entry.isDirectory()) {
        requireValue(directories.has(name), `Extra directory in source archive: ${name}`);
        walk(path.join(directory, entry.name), name + '/');
      }
      else {
        requireValue(entry.isFile(), `Non-file in source archive: ${name}`);
        actual.push(name);
      }
    }
  };
  requireValue(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink(), 'Invalid archive root');
  walk(root);
  actual.sort();
  requireValue(canonical(actual) === canonical(snapshot.files.map(file => file.path)), 'Source archive contains missing or extra files');
  for (const file of snapshot.files) {
    const absolute = sourceFile(root, file.path);
    requireValue(sha256(readFileSync(absolute)) === file.sha256, `Source content changed: ${file.path}`);
    // Git records executability, not ownership/umask. Windows archives have no POSIX mode guarantee.
    if (process.platform !== 'win32') requireValue(Boolean(lstatSync(absolute).mode & 0o111) === (file.mode === '100755'), `Source mode changed: ${file.path}`);
  }
}

export function readJson(file) {
  const stat = lstatSync(file);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 16 * 1024 * 1024, 'Invalid or oversized release JSON file');
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('Invalid release JSON'); }
}
