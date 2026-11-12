import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const temporaryDirectories: string[] = [];
const fixture = path.join(root, 'tests/fixtures/restore-verifier-process.mjs');
const source = path.join(root, 'scripts/verify-restored-database.ts');

function run(scenario = 'success', env: Record<string, string> = {}, manifest?: string) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'polutek-restore-test-'));
  temporaryDirectories.push(directory);
  const manifestPath = path.join(directory, 'manifest.json');
  if (manifest !== undefined) writeFileSync(manifestPath, manifest);
  return spawnSync(process.execPath, [fixture, source, scenario], {
    cwd: root,
    env: {
      ...process.env,
      RESTORE_DATABASE_URL: 'postgresql://fixture_user:fixture_password@127.0.0.1:5432/restored_fixture',
      DATABASE_URL: 'postgresql://fixture_user:fixture_password@127.0.0.1:5432/source_fixture',
      ALLOW_RESTORE_VERIFICATION: 'true',
      RESTORE_EXPECTED_MANIFEST_PATH: manifest === undefined ? '' : manifestPath,
      ...env,
    },
    encoding: 'utf8', timeout: 10_000,
  });
}

function expectFailure(result: ReturnType<typeof run>, connected = true) {
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain('VERIFICATION SUCCESSFUL');
  if (connected) expect(result.stdout).toContain('FIXTURE_DISCONNECTED');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('restore verification CLI result', () => {
  it.each([
    ['missing target', { RESTORE_DATABASE_URL: '' }],
    ['missing permission', { ALLOW_RESTORE_VERIFICATION: 'false' }],
    ['target equals source', { RESTORE_DATABASE_URL: 'same-fixture', DATABASE_URL: 'same-fixture' }],
  ] as const)('refuses %s before constructing a client', (_name, env) => {
    const result = run('success', env);
    expectFailure(result, false);
    expect(result.stdout).not.toContain('FIXTURE_CLIENT_CREATED');
  });

  it('completes checks, closes the client and exits successfully without leaking credentials', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('User: 1 rows');
    expect(result.stdout).toContain('AuditLog: 1 rows');
    expect(result.stdout).toContain('VERIFICATION SUCCESSFUL');
    expect(result.stdout).toContain('FIXTURE_DISCONNECTED');
    expect(result.stdout + result.stderr).not.toContain('fixture_password');
  });

  it.each(['connection-failure', 'migration-read-failure', 'migration-unfinished', 'migration-failed'])(
    'fails and closes the client for %s', scenario => expectFailure(run(scenario)),
  );

  it('allows a rolled-back attempt alongside completed migration history', () => {
    const result = run('migration-rolled-back');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('VERIFICATION SUCCESSFUL');
  });

  it.each(['User', 'Creator', 'Video', 'VideoAsset', 'Payment', 'UserPaymentTotal', 'PatronGrant', 'StripeEvent', 'Comment', 'CommentReport', 'Subscription', 'AuditLog'])(
    'fails when mandatory %s count cannot be checked without a manifest', model => expectFailure(run(`count:${model}`)),
  );

  it('fails when a manifest count has no observed value', () => {
    expectFailure(run('count:User', {}, JSON.stringify({ counts: { User: 1 } })));
  });

  it.each([
    ['unknown aggregate', JSON.stringify({ counts: { UnknownAggregate: 1 } })],
    ['different count', JSON.stringify({ counts: { User: 2 } })],
    ['empty counts object', JSON.stringify({ counts: {} })],
    ['missing counts object', JSON.stringify({})],
    ['array instead of counts object', JSON.stringify({ counts: [] })],
    ['invalid JSON', '{'],
  ])('fails for manifest %s', (_name, manifest) => expectFailure(run('success', {}, manifest)));

  it('accepts a matching manifest', () => {
    const result = run('success', {}, JSON.stringify({ counts: { User: 1, Video: 1, Payment: 1 } }));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('User matches manifest');
    expect(result.stdout).toContain('VERIFICATION SUCCESSFUL');
  });

  it.each(['orphan-user', 'orphan-payment', 'orphan-video'])(
    'rejects %s instead of reporting success', scenario => expectFailure(run(scenario)),
  );
});
