#!/usr/bin/env node
import { readJson, requireValue } from './release/source.mjs';
import { produceRelease } from './release/produce.mjs';

try {
  const options = Object.create(null);
  for (const flag of process.argv.slice(2)) {
    const match = /^--(revision|inputs|out)=(.+)$/s.exec(flag);
    requireValue(match && !Object.hasOwn(options, match[1]), 'Usage: release-produce.mjs --revision=SHA --inputs=FILE --out=NEW_DIRECTORY');
    options[match[1]] = match[2];
  }
  requireValue(options.revision && options.inputs && options.out, 'Full --revision, --inputs and --out are required');
  const result = produceRelease({ root: process.cwd(), revision: options.revision, inputs: readJson(options.inputs), output: options.out });
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // Child diagnostics are already in the control logs; never echo arbitrary environment/config contents.
  process.stderr.write('Release production failed; no approved release was produced. Review local control logs.\n');
  process.exitCode = 1;
}
