#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { publishRelease } from './release/publish.mjs';
import { readJson, requireValue } from './release/source.mjs';

function readOptions(argv) {
  const allowed = new Set(['proof', 'proof-sha256', 'revision', 'source', 'inputs', 'registry', 'tag', 'out']);
  const options = Object.create(null);
  for (const flag of argv) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/s.exec(flag);
    requireValue(match && allowed.has(match[1]) && !Object.hasOwn(options, match[1]), 'Invalid or duplicate release publication option');
    options[match[1]] = match[2];
  }
  for (const name of allowed) requireValue(options[name], `Missing release publication option: ${name}`);
  return options;
}

try {
  const options = readOptions(process.argv.slice(2));
  const result = publishRelease({ proof: readJson(options.proof), proofSha256: options['proof-sha256'], revision: options.revision,
    sourceRoot: options.source, inputs: readJson(options.inputs), registry: options.registry, tag: options.tag, output: options.out });
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  process.stderr.write('Release publication failed; no complete approved image set was produced. Review local control logs.\n');
  process.exitCode = 1;
}
