#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseInputs } from './release/inputs.mjs';
import { requireValue } from './release/source.mjs';

const DEFAULT_BASES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'release/bases-linux-amd64.json');

try {
  const args = process.argv.slice(2);
  requireValue(args.length === 1 && /^--out=.+$/s.test(args[0]),
    'Usage: release-inputs.mjs --out=NEW_FILE');
  const output = args[0].slice('--out='.length);
  const bases = JSON.parse(readFileSync(DEFAULT_BASES, 'utf8'));
  const inputs = createReleaseInputs(process.env, bases);
  writeFileSync(output, JSON.stringify(inputs, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write('Release build inputs validated and written.\n');
} catch {
  process.stderr.write('Could not create valid release inputs.\n');
  process.exitCode = 1;
}
