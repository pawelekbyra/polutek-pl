import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IMAGE_ID, hashJson, requireValue, verifySourceArchive } from './source.mjs';
import { IMAGE_KINDS, expectedLabels, validateInputs, validateQuality } from './policy.mjs';
import { createProof, inspectImage } from './proof.mjs';

const TARGETS = Object.freeze({ app: 'runner', migrator: 'migrator', worker: 'worker', collector: 'collector', admin: 'admin' });

function dockerBuild(args) {
  // Only one build runs at a time. No daemon configuration, services or publication.
  execFileSync('nice', ['-n', '10', 'docker', ...args], { stdio: 'inherit', timeout: 45 * 60_000 });
}

/** Build a reviewed, complete quality report. This does not authenticate the report's producer. */
export function buildRelease({ report, inputs, revision, sourceRoot, output }, build = dockerBuild, inspect = inspectImage) {
  requireValue(/^v22\./.test(process.version), 'Release builds require Node 22');
  requireValue(process.platform !== 'win32', 'Release builds require POSIX archive modes');
  const quality = validateQuality(report, revision);
  validateInputs(inputs);
  verifySourceArchive(sourceRoot, quality.source);
  const context = path.resolve(sourceRoot);
  const destination = path.resolve(output);
  const relative = path.relative(context, destination);
  requireValue(relative && (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)), 'Build output must be outside the source archive');
  // Never reuse an old iidfile or proof after a partial failure.
  mkdirSync(destination, { mode: 0o700 });
  const references = {};
  for (const kind of IMAGE_KINDS) {
    verifySourceArchive(context, quality.source);
    const iidfile = path.join(destination, `${kind}.iid`);
    const dockerfile = kind === 'admin' ? 'deploy/serwerek/Dockerfile.admin' : 'deploy/serwerek/Dockerfile';
    const args = ['buildx', 'build', '--load', '--platform', inputs.platform, '--file', path.join(context, dockerfile),
      '--target', TARGETS[kind], '--iidfile', iidfile];
    for (const [key, value] of Object.entries(inputs.bases)) args.push('--build-arg', `${key.toUpperCase()}_BASE=${value}`);
    for (const [key, value] of Object.entries(inputs.public_args)) args.push('--build-arg', `${key}=${value}`);
    for (const [key, value] of Object.entries(expectedLabels(report, inputs, revision, kind))) args.push('--label', `${key}=${value}`);
    args.push(context);
    build(args);
    const identity = readFileSync(iidfile, 'utf8').trim();
    requireValue(IMAGE_ID.test(identity), `Build did not return an immutable image ID: ${kind}`);
    references[kind] = identity;
  }
  const proof = createProof({ report, inputs, references, sourceRoot: context, revision }, inspect);
  const proofPath = path.join(destination, 'proof.json');
  writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { sealed: true, revision, proof_sha256: hashJson(proof), path: proofPath };
}
