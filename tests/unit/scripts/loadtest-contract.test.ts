import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { hasExpectedLoadContentType } from '../../../scripts/loadtest/response-contract.mjs';

const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'polutek-loadtest-summary-'));
const script = path.join(root, 'scripts/loadtest/summarize.py');

function summary(overrides: Record<string, unknown> = {}) {
  return {
    metrics: {
      iterations: { values: { count: 100, rate: 10 } },
      dropped_iterations: { values: { count: 0 } },
      http_reqs: { values: { count: 500, rate: 50 } },
      server_errors: { values: { rate: 0 } },
      unexpected_status: { values: { count: 0 } },
      unexpected_content: { values: { count: 0 } },
      http_req_duration: { values: { med: 80, 'p(95)': 120, 'p(99)': 150, max: 300 } },
      ...overrides,
    },
  };
}

function runSummary(data: unknown) {
  const file = path.join(temp, 'summary.json');
  writeFileSync(file, JSON.stringify(data));
  return spawnSync('python3', [script, file, 'journey', '10'], { encoding: 'utf8' });
}

afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe('load-test response contract', () => {
  it.each([
    ['home', { 'Content-Type': 'text/html; charset=utf-8' }],
    ['sidebar', { 'content-type': 'application/json; charset=utf-8' }],
    ['comments', { 'Content-Type': 'application/problem+json' }],
    ['media', { 'Content-Type': 'application/json' }],
    ['thumb', { 'Content-Type': 'image/webp' }],
  ])('accepts expected %s MIME', (endpoint, headers) => {
    expect(hasExpectedLoadContentType(endpoint, headers)).toBe(true);
  });

  it.each([
    ['home', { 'Content-Type': 'application/json' }],
    ['sidebar', { 'Content-Type': 'text/html' }],
    ['comments', {}],
    ['media', { 'Content-Type': 'text/plain' }],
    ['thumb', { 'Content-Type': 'text/html' }],
  ])('rejects wrong/missing %s MIME', (endpoint, headers) => {
    expect(hasExpectedLoadContentType(endpoint, headers)).toBe(false);
  });

  it('accepts a complete healthy summary', () => {
    const result = runSummary(summary());
    expect(result.status).toBe(0);
    expect(result.stdout.replace(/\r?\n$/, '').split('\t')).toHaveLength(14);
  });

  it('fails a summary with unexpected non-200 statuses even when server error rate is zero', () => {
    const result = runSummary(summary({ unexpected_status: { values: { count: 1 } } }));
    expect(result.status).toBe(13);
    expect(result.stdout).toContain('\t1\t0\t');
  });

  it('fails a 200 response with wrong content type', () => {
    const result = runSummary(summary({ unexpected_content: { values: { count: 1 } } }));
    expect(result.status).toBe(13);
    expect(result.stdout).toContain('\t0\t1\t');
  });

  it('fails closed when a required k6 metric is absent', () => {
    const metrics = summary().metrics;
    delete (metrics as Record<string, unknown>).unexpected_content;
    const result = runSummary({ metrics });
    expect(result.status).toBe(14);
    expect(result.stderr).toContain('unexpected_content');
  });

  it('makes run-steps fail instead of continuing on invalid or incomplete summaries', () => {
    const runner = readFileSync(path.join(root, 'scripts/loadtest/run-steps.sh'), 'utf8');
    expect(runner).toContain('13) echo "invalid result: unexpected status or response content type" >&2; exit 13 ;;');
    expect(runner).toContain('14) echo "invalid result: incomplete k6 summary" >&2; exit 14 ;;');
    expect(runner).toContain('*) echo "invalid result: summarizer failed (exit $code)" >&2; exit "$code" ;;');
    expect(runner).toContain('incompatible results.tsv header; select a fresh OUT_DIR or archive the previous results');
  });

  it('preserves the HTTP 5xx/timeouts stop gate', () => {
    const result = runSummary(summary({ server_errors: { values: { rate: 0.03 } } }));
    expect(result.status).toBe(11);
  });

  it('preserves saturation and p95 stop gates', () => {
    expect(runSummary(summary({ dropped_iterations: { values: { count: 100 } } })).status).toBe(12);
    expect(runSummary(summary({ http_req_duration: { values: { med: 80, 'p(95)': 2100, 'p(99)': 2200, max: 3000 } } })).status).toBe(10);
  });
});
