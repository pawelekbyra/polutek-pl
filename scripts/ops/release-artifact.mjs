#!/usr/bin/env node
// Convert the Actions artifact layout into the narrow directory consumed by deploy-release.mjs.
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HASH, hashJson, readJson, safeSourcePath, validateSnapshot, verifySourceArchive } from './release/source.mjs';

const fail = message => { throw new Error(message); };
const regularFile = file => {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024 * 1024) fail('Release artifact contains an invalid file');
};

export function prepareReleaseArtifact({ artifact, revision, approvedProofSha256, output }) {
  if (!/^v22\./.test(process.version) || process.platform === 'win32') fail('Artifact preparation requires Node 22 on POSIX');
  if (!/^[a-f0-9]{40}$/.test(revision ?? '') || !HASH.test(approvedProofSha256 ?? '') || !artifact || !output) {
    fail('Full revision, externally approved proof hash, artifact directory and output directory are required');
  }
  const inputDir = path.resolve(artifact);
  const out = path.resolve(output);
  const sourceTar = path.join(inputDir, 'source.tar');
  const qualityFile = path.join(inputDir, 'quality.json');
  const inputsFile = path.join(inputDir, 'inputs.json');
  const proofFile = path.join(inputDir, 'published-release-proof.json');
  const resultFile = path.join(inputDir, 'published-release-result.json');
  for (const file of [sourceTar, qualityFile, inputsFile, proofFile, resultFile]) regularFile(file);
  if (existsSync(out)) fail('Release output directory already exists');

  const proof = readJson(proofFile);
  // Check independent approval before listing or extracting the archive. An unapproved artifact
  // must not be allowed to make the local deploy host process untrusted tar entries.
  if (hashJson(proof) !== approvedProofSha256) fail('Artifact proof does not match the externally approved hash');

  const quality = readJson(qualityFile);
  const inputs = readJson(inputsFile);
  const result = readJson(resultFile);
  if (proof.revision !== revision || result.revision !== revision || result.published !== true) fail('Artifact revision/status mismatch');
  if (hashJson(proof) !== result.proof_sha256) fail('Artifact proof hash does not match the published result');
  if (hashJson(proof.quality) !== hashJson(quality) || hashJson(proof.inputs) !== hashJson(inputs)) fail('Artifact quality or inputs mismatch');
  validateSnapshot(quality.sourceBefore);
  if (quality.head !== revision || quality.sourceBefore.revision !== revision
      || hashJson(quality.sourceBefore) !== hashJson(quality.sourceAfter) || quality.sourceStable !== true || quality.dirtyAfter !== false) {
    fail('Artifact quality source revision/stability mismatch');
  }

  const listing = execFileSync('tar', ['-tf', sourceTar], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const entries = listing.split('\n').filter(Boolean);
  if (!entries.length) fail('Empty release source archive');
  for (const entry of entries) {
    const normalized = entry.endsWith('/') ? entry.slice(0, -1) : entry;
    if (!safeSourcePath(normalized)) fail('Unsafe path in release source archive');
  }

  const parent = path.dirname(out);
  mkdirSync(parent, { recursive: true });
  const temp = mkdtempSync(path.join(parent, '.release-artifact-'));
  try {
    const source = path.join(temp, 'source');
    mkdirSync(source, { mode: 0o700 });
    execFileSync('tar', ['--no-same-owner', '--no-same-permissions', '-xf', sourceTar, '-C', source], { stdio: 'ignore' });
    const walk = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink()) fail('Symlink in release source archive');
        if (entry.isDirectory()) walk(absolute);
        else if (!stat.isFile()) fail('Unsupported file in release source archive');
      }
    };
    walk(source);
    verifySourceArchive(source, quality.sourceBefore);
    cpSync(proofFile, path.join(temp, 'proof.json'));
    cpSync(inputsFile, path.join(temp, 'inputs.json'));
    chmodSync(path.join(temp, 'proof.json'), 0o600);
    chmodSync(path.join(temp, 'inputs.json'), 0o600);
    writeFileSync(path.join(temp, 'proof.sha256'), `${result.proof_sha256}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(temp, out);
    return { prepared: true, revision, proof_sha256: result.proof_sha256, output: out };
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = Object.create(null);
    for (const flag of process.argv.slice(2)) {
      const match = /^--([a-z][a-z0-9-]*)=(.+)$/s.exec(flag);
      if (!match || !['artifact', 'revision', 'approved-proof-sha256', 'out'].includes(match[1]) || Object.hasOwn(options, match[1])) fail('Invalid release artifact option');
      options[match[1]] = match[2];
    }
    const result = prepareReleaseArtifact({ artifact: options.artifact, revision: options.revision,
      approvedProofSha256: options['approved-proof-sha256'], output: options.out });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Release artifact preparation failed'}\n`);
    process.exitCode = 1;
  }
}
