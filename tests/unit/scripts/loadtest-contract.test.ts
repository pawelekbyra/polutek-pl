import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { hasExpectedLoadContentType, hasExpectedLoadResponseBody } from '../../../scripts/loadtest/response-contract.mjs';
import { hashClientValue } from '../../../lib/modules/privacy/domain/client-hash';

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

  it.each([
    ['sidebar', { viewerState: 'ANONYMOUS', currentVideoId: 'video-1', sections: [{ id: 'free', type: 'FREE', title: 'Publiczne', items: [], total: 0 }] }],
    ['comments', { success: true, comments: [], totalCount: 0, nextCursor: null, viewer: { canComment: true, canReact: true, canReport: true, canModerate: false, commentsDisabled: false } }],
    ['media', { videoId: 'video-1', status: 'READY', canPlay: true, access: { allowed: true }, source: { playbackUrl: '/hls/signed/master.m3u8' } }],
  ])('accepts the expected %s JSON body shape', (endpoint, body) => {
    expect(hasExpectedLoadResponseBody(endpoint, JSON.stringify(body))).toBe(true);
  });

  it.each([
    ['sidebar', '{"unexpected":true}'],
    ['sidebar', '{not json'],
    ['comments', '{"success":false,"message":"error"}'],
    ['comments', '{"success":true,"comments":[],"totalCount":"zero"}'],
    ['media', '{"videoId":"video-1","status":"PROCESSING","canPlay":false,"access":{"allowed":false}}'],
    ['media', 'upstream proxy error page'],
  ])('rejects HTTP 200 with invalid %s content', (endpoint, body) => {
    expect(hasExpectedLoadResponseBody(endpoint, body)).toBe(false);
  });

  it('does not require response bodies for the large HTML or image endpoints', () => {
    expect(hasExpectedLoadResponseBody('home', null)).toBe(true);
    expect(hasExpectedLoadResponseBody('thumb', null)).toBe(true);
  });

  it('reports zero dropped arrivals for fixed-count iterations when k6 omits that metric', () => {
    const k6 = readFileSync(path.join(root, 'scripts/loadtest/k6-guest.js'), 'utf8');
    expect(k6).toContain('if (ITERATIONS && !data.metrics.dropped_iterations)');
    expect(k6).toContain('values: { count: 0, rate: 0 }');
  });

  it('writes a versioned profile that distinguishes guest journeys from concurrent viewers', () => {
    const output = path.join(temp, 'journey-profile.json');
    const profileScript = path.join(root, 'scripts/loadtest/profile-metadata.py');
    const result = spawnSync('python3', [profileScript, output, 'journey', '2', '8', '60', '30', '2000', 'warm-check', 'grafana/k6:1.3.0', path.join(root, 'scripts/loadtest')], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const profile = JSON.parse(readFileSync(output, 'utf8')) as {
      profile_id: string; rate_metric: string; iteration_unit: string; requests_per_iteration: number;
      rate_schedule_per_second: number[]; viewer_concurrency_measured: boolean; interpretation: string;
      cache_state: string; source_sha256: Record<string, string>;
    };
    expect(profile.profile_id).toBe('polutek-guest-read-only-v1');
    expect(profile.rate_metric).toBe('new_guest_journeys_per_second');
    expect(profile.iteration_unit).toBe('new_guest_journey');
    expect(profile.requests_per_iteration).toBe(5);
    expect(profile.rate_schedule_per_second).toEqual([2, 4, 8]);
    expect(profile.viewer_concurrency_measured).toBe(false);
    expect(profile.interpretation).toContain('not concurrent viewers');
    expect(profile.cache_state).toContain('does not prove cache state');
    expect(Object.keys(profile.source_sha256)).toContain('k6-guest.js');
  });

  it('labels single-endpoint profiles as requests per second rather than viewers', () => {
    const output = path.join(temp, 'comments-profile.json');
    const profileScript = path.join(root, 'scripts/loadtest/profile-metadata.py');
    const result = spawnSync('python3', [profileScript, output, 'comments', '32', '64', '60', '30', '1000', 'comments-warm', 'grafana/k6:1.3.0', path.join(root, 'scripts/loadtest')], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const profile = JSON.parse(readFileSync(output, 'utf8')) as { rate_metric: string; routes: Array<{ route: string }>; interpretation: string };
    expect(profile.rate_metric).toBe('single_endpoint_requests_per_second');
    expect(profile.routes[0].route).toBe('/api/comments');
    expect(profile.interpretation).toContain('not viewers');
  });

  it('refuses to overwrite a profile hash target with different run parameters', () => {
    const output = path.join(temp, 'immutable-profile.json');
    const profileScript = path.join(root, 'scripts/loadtest/profile-metadata.py');
    const args = [profileScript, output, 'home', '4', '16', '60', '30', '2000', 'same-label', 'grafana/k6:1.3.0', path.join(root, 'scripts/loadtest')];
    expect(spawnSync('python3', args, { encoding: 'utf8' }).status).toBe(0);
    const original = readFileSync(output, 'utf8');
    const conflict = spawnSync('python3', [...args.slice(0, 4), '32', ...args.slice(5)], { encoding: 'utf8' });
    expect(conflict.status).toBe(2);
    expect(conflict.stderr).toContain('choose a new LABEL or OUT_DIR');
    expect(readFileSync(output, 'utf8')).toBe(original);
  });

  it('versions fixed-count query measurements without pretending they are throughput', () => {
    const output = path.join(temp, 'count-comments-profile.json');
    const profileScript = path.join(root, 'scripts/loadtest/profile-metadata.py');
    const result = spawnSync('python3', [profileScript, output, 'comments', '1', '1', '0', '0', '2000', 'count-comments-n25', 'grafana/k6:1.3.0', path.join(root, 'scripts/loadtest'), 'per-vu-iterations', '25'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const profile = JSON.parse(readFileSync(output, 'utf8')) as {
      executor: string; rate_metric: string; fixed_iteration_count: number;
      rate_schedule_per_second: number[] | null; interpretation: string; source_sha256: Record<string, string>;
    };
    expect(profile.executor).toBe('per-vu-iterations');
    expect(profile.rate_metric).toBe('fixed_request_count');
    expect(profile.fixed_iteration_count).toBe(25);
    expect(profile.rate_schedule_per_second).toBeNull();
    expect(profile.interpretation).toContain('not throughput or concurrent viewers');
    expect(profile.source_sha256).toHaveProperty('count-queries.sh');
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
    expect(runner).toContain('invalid LABEL; use only letters, digits, dot, underscore or hyphen');
    expect(runner).toContain('profile-metadata.py');
    expect(runner).toContain('profile_sha256');
    const counter = readFileSync(path.join(root, 'scripts/loadtest/count-queries.sh'), 'utf8');
    expect(counter).toContain('profile-metadata.py');
    expect(counter).toContain('per-vu-iterations');
    expect(counter).toContain('profile_sha256=%s');
  });

  it('derives cleanup identity with the same HMAC protocol as playback sessions', () => {
    const userAgent = 'pp-loadtest/123e4567-e89b-12d3-a456-426614174000';
    const secret = 'loadtest-only-test-secret';
    const result = spawnSync('node', [path.join(root, 'scripts/loadtest/session-hash.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, LOADTEST_USER_AGENT: userAgent, IP_HASH_SECRET: secret },
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(hashClientValue(userAgent, { IP_HASH_SECRET: secret }));
    expect(result.stdout).not.toContain(secret);
  });

  it('requires an exact per-run identity and refuses cleanup while a run is active', () => {
    const cleanup = readFileSync(path.join(root, 'scripts/loadtest/cleanup.sh'), 'utf8');
    const runner = readFileSync(path.join(root, 'scripts/loadtest/run-steps.sh'), 'utf8');
    const k6 = readFileSync(path.join(root, 'scripts/loadtest/k6-guest.js'), 'utf8');

    expect(cleanup).toContain('if [ -d "$LOCK" ]');
    expect(cleanup).toContain('missing run identity; refusing to delete playback sessions');
    expect(cleanup).toContain('session-hash.mjs');
    expect(cleanup).toContain('where "userAgentHash" = :\'h\' and "userId" is null');
    expect(runner).toContain('/proc/sys/kernel/random/uuid');
    expect(runner).toContain('-e LOADTEST_USER_AGENT="$LOADTEST_USER_AGENT"');
    expect(k6).toContain('const UA = __ENV.LOADTEST_USER_AGENT;');
    expect(k6).toContain('requestParams.responseType = responseType');
    expect(k6).toContain('params("sidebar", ip, undefined, "text")');
    expect(k6).toContain('params("comments", ip, undefined, "text")');
    expect(k6).toContain('params("media", ip, undefined, "text")');
    expect(k6).toContain('!hasExpectedLoadResponseBody(endpoint, res.body)');
  });

  it('deletes only rows matching the app-derived HMAC and retains identity if the app is unavailable', () => {
    const sandbox = mkdtempSync(path.join(tmpdir(), 'polutek-loadtest-cleanup-'));
    const bin = path.join(sandbox, 'bin');
    const out = path.join(sandbox, 'out');
    const trace = path.join(sandbox, 'docker.log');
    const sql = path.join(sandbox, 'cleanup.sql');
    const docker = path.join(bin, 'docker');
    const userAgent = 'pp-loadtest/123e4567-e89b-12d3-a456-426614174000';
    const secret = 'loadtest-cleanup-test-secret';
    const script = `#!/usr/bin/env bash
if [[ "$*" == *polutek-app-1* ]]; then
  for arg in "$@"; do [[ "$arg" == LOADTEST_USER_AGENT=* ]] && export "$arg"; done
  [ "\${FAIL_APP_HASH:-}" != 1 ] || exit 21
  exec node -
fi
if [[ "$*" == *polutek-db-1* ]]; then printf '%s\\n' "$*" >> "$DOCKER_TRACE"; cat > "$SQL_CAPTURE"; exit 0; fi
exit 0
`;
    mkdirSync(bin, { recursive: true });
    mkdirSync(out, { recursive: true });
    writeFileSync(docker, script, { mode: 0o755 });
    writeFileSync(path.join(out, 'client-user-agent'), `${userAgent}\n`);

    try {
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, OUT_DIR: out, DOCKER_TRACE: trace, SQL_CAPTURE: sql, IP_HASH_SECRET: secret };
      const result = spawnSync('bash', [path.join(root, 'scripts/loadtest/cleanup.sh'), '--keep-image'], { encoding: 'utf8', env });
      const expectedHash = hashClientValue(userAgent, { IP_HASH_SECRET: secret });
      expect(result.status).toBe(0);
      expect(readFileSync(sql, 'utf8')).toContain('where "userAgentHash" = :\'h\' and "userId" is null;');
      expect(readFileSync(trace, 'utf8')).toContain(expectedHash);
      expect(readFileSync(trace, 'utf8')).not.toContain(secret);

      writeFileSync(path.join(out, 'client-user-agent'), `${userAgent}\n`);
      const failed = spawnSync('bash', [path.join(root, 'scripts/loadtest/cleanup.sh'), '--keep-image'], {
        encoding: 'utf8', env: { ...env, FAIL_APP_HASH: '1', SQL_CAPTURE: `${sql}.must-not-exist` },
      });
      expect(failed.status).toBe(9);
      expect(readFileSync(path.join(out, 'client-user-agent'), 'utf8').trim()).toBe(userAgent);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
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
