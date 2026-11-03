#!/usr/bin/env node
// Local evidence validator, not a signer or a deployment command. Producer/consumer wiring is separate.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { HASH, REVISION, hashJson, readJson, requireValue, verifySourceArchive } from './release/source.mjs';
import { IMAGE_KINDS, expectedLabels, validateInputs, validateQuality } from './release/policy.mjs';
import { createProof, verifyProof } from './release/proof.mjs';
import { buildRelease } from './release/build.mjs';

function run(argv) {
  const [command, ...flags] = argv;
  const allowed = {
    'check-ci': ['report', 'revision', 'source'],
    labels: ['report', 'revision', 'source', 'inputs', 'kind'],
    seal: ['report', 'revision', 'source', 'inputs', 'images', 'out'],
    build: ['report', 'revision', 'source', 'inputs', 'out'],
    verify: ['proof', 'proof-sha256', 'revision', 'source', 'inputs', 'scope'],
  };
  requireValue(Object.hasOwn(allowed, command), 'Usage: release-proof.mjs check-ci|labels|build|seal|verify --key=value');
  const options = Object.create(null);
  for (const flag of flags) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/s.exec(flag);
    requireValue(match && allowed[command].includes(match[1]) && !Object.hasOwn(options, match[1]), 'Unknown, empty or duplicate release option');
    options[match[1]] = match[2];
  }
  requireValue(REVISION.test(options.revision ?? '') && options.source, 'Full --revision and --source archive are required');
  if (command === 'verify') {
    requireValue(options.proof && options.inputs && options['proof-sha256'], '--proof, --proof-sha256 and --inputs are required');
    const proof = readJson(options.proof);
    const identities = verifyProof({ proof, proofSha256: options['proof-sha256'], revision: options.revision, sourceRoot: options.source,
      inputs: readJson(options.inputs), scope: options.scope ?? 'all' });
    return { verified: true, revision: options.revision, proof_sha256: hashJson(proof), images: identities };
  }
  requireValue(options.report, '--report is required');
  const report = readJson(options.report);
  const quality = validateQuality(report, options.revision);
  verifySourceArchive(options.source, quality.source);
  if (command === 'check-ci') return { verified: true, revision: options.revision, source_fingerprint: quality.source.fingerprint, quality_sha256: quality.qualitySha256 };
  requireValue(options.inputs, '--inputs is required');
  const inputs = readJson(options.inputs);
  validateInputs(inputs);
  if (command === 'build') {
    requireValue(options.out, '--out is required');
    return buildRelease({ report, inputs, revision: options.revision, sourceRoot: options.source, output: options.out });
  }
  if (command === 'labels') {
    requireValue(IMAGE_KINDS.includes(options.kind), '--kind is required');
    return expectedLabels(report, inputs, options.revision, options.kind);
  }
  requireValue(options.images && options.out, '--images and --out are required');
  const proof = createProof({ report, inputs, references: readJson(options.images), sourceRoot: options.source, revision: options.revision });
  requireValue(HASH.test(proof.inputs_sha256), 'Invalid release input digest');
  writeFileSync(options.out, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { sealed: true, revision: options.revision, proof_sha256: hashJson(proof), path: path.resolve(options.out) };
}

try { process.stdout.write(JSON.stringify(run(process.argv.slice(2))) + '\n'); }
catch (error) { process.stderr.write(`${error instanceof Error ? error.message : 'Release proof failed'}\n`); process.exitCode = 1; }
