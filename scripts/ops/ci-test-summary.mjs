#!/usr/bin/env node
// Prints the result of a Vitest JSON report (counts + every skipped/todo test) to stdout and, in GitHub Actions,
// to the job summary ($GITHUB_STEP_SUMMARY). Used by .github/workflows/ci.yml so skipped tests are visible,
// never silent. Reporting only: the exit code is always 0 (the vitest step itself decides pass/fail).
// Usage: node scripts/ops/ci-test-summary.mjs <vitest.json> [title]
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { parseVitestJson, toPosix } from './local-ci-lib.mjs';

const [file, title = 'vitest'] = process.argv.slice(2);
const MAX_LISTED = 100;

function render() {
  if (!file || !existsSync(file)) return `### ${title}\n\nNo Vitest JSON report (\`${file ?? '?'}\`): the run crashed before the reporter wrote it. See the log of the previous step.\n`;
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return `### ${title}\n\nThe Vitest JSON report could not be parsed: ${error.message}\n`;
  }
  const s = parseVitestJson(json);
  const skipped = [];
  for (const result of json.testResults ?? []) {
    const name = toPosix(String(result.name ?? '')).replace(/^.*?(?=tests\/)/, '');
    for (const test of result.assertionResults ?? []) {
      if (test.status === 'skipped' || test.status === 'pending' || test.status === 'todo') {
        skipped.push(`- \`${name}\`: ${test.fullName ?? test.title ?? '?'}${test.status === 'todo' ? ' (todo)' : ''}`);
      }
    }
  }
  const lines = [
    `### ${title}`,
    '',
    '| files | tests | passed | failed | skipped/todo |',
    '|---:|---:|---:|---:|---:|',
    `| ${s.files} | ${s.total} | ${s.passed} | ${s.failed} | ${s.skipped} |`,
    '',
  ];
  if (s.failedFiles.length) lines.push('**Failed files:**', ...s.failedFiles.map((f) => `- \`${f}\``), '');
  if (skipped.length) {
    lines.push(`**Skipped tests (${skipped.length}):**`, ...skipped.slice(0, MAX_LISTED));
    if (skipped.length > MAX_LISTED) lines.push(`- ... and ${skipped.length - MAX_LISTED} more`);
    lines.push('');
  } else {
    lines.push('No skipped tests.', '');
  }
  return `${lines.join('\n')}\n`;
}

const text = render();
process.stdout.write(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
