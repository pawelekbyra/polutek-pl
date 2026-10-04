import { describe, expect, it } from 'vitest';
import {
  DESTRUCTIVE_ALLOW_MARKER,
  STATUS,
  blockedBy,
  checkMigrations,
  classifyChanges,
  formatMarkdown,
  formatTable,
  isFileReadingTest,
  parseArgs,
  parseEslintSummary,
  parseTscOutput,
  parseVitestJson,
  parseWorkflowEnv,
  parseWorkflowRuns,
  pickRunnable,
  planLint,
  planUnitTests,
  summarize,
  uncoveredWorkflowRuns,
} from '@/scripts/ops/local-ci-lib.mjs';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('parseArgs', () => {
  it('defaults to the change-based run', () => {
    expect(parseArgs([])).toMatchObject({ lintAll: false, unitFull: false, build: false, strict: false, base: 'origin/main', unknown: [] });
  });

  it('--full turns on whole lint, whole suite and builds', () => {
    expect(parseArgs(['--full'])).toMatchObject({ lintAll: true, unitFull: true, build: true });
  });

  it('parses lists and numbers and reports unknown flags', () => {
    const opts = parseArgs(['--only=lint,unit', '--skip=audit', '--jobs=3', '--base=origin/dev', '--jobs=x', '--wat']);
    expect(opts.only).toEqual(['lint', 'unit']);
    expect(opts.skip).toEqual(['audit']);
    expect(opts.jobs).toBe(3);
    expect(opts.base).toBe('origin/dev');
    expect(opts.unknown).toEqual(['--jobs=x', '--wat']);
  });
});

const WORKFLOW = `name: CI
env:
  DATABASE_URL: postgresql://ci:ci@localhost:5432/ci
  REFERRAL_PATRON_THRESHOLD: "5"
  ENCODE: 'x'

jobs:
  lint:
    steps:
      - run: npm ci
      - run: npm run lint
  security:
    steps:
      - name: npm audit high
        run: npm run audit:high
      - run: npx vitest run tests/unit/hls/encode-hls.ffmpeg.test.ts
        env:
          ENCODE_SMOKE: '1'
`;

describe('workflow parsing', () => {
  it('reads the workflow-level env block and strips quotes', () => {
    expect(parseWorkflowEnv(WORKFLOW)).toEqual({
      DATABASE_URL: 'postgresql://ci:ci@localhost:5432/ci',
      REFERRAL_PATRON_THRESHOLD: '5',
      ENCODE: 'x',
    });
  });

  it('lists every run command, including those after a step name', () => {
    expect(parseWorkflowRuns(WORKFLOW)).toEqual(['npm ci', 'npm run lint', 'npm run audit:high', 'npx vitest run tests/unit/hls/encode-hls.ffmpeg.test.ts']);
  });

  it('reports CI commands that local-ci does not reproduce', () => {
    const runs = parseWorkflowRuns(WORKFLOW);
    expect(uncoveredWorkflowRuns(runs, ['npm run lint', 'npm run audit:high'], ['npm ci'])).toEqual(['npx vitest run tests/unit/hls/encode-hls.ffmpeg.test.ts']);
  });
});

describe('classifyChanges and plans', () => {
  it('splits sources, tests and lintable files, with Windows separators normalized', () => {
    const c = classifyChanges(['app\\components\\Hero.tsx', 'tests/unit/a.test.ts', 'docs/x.md', 'prisma/migrations/2026_x/migration.sql'], ['lib/old.ts']);
    expect(c.sources).toEqual(['app/components/Hero.tsx']);
    expect(c.tests).toEqual(['tests/unit/a.test.ts']);
    expect(c.lintable).toEqual(['app/components/Hero.tsx', 'tests/unit/a.test.ts']);
    expect(c.migrations).toEqual(['prisma/migrations/2026_x/migration.sql']);
    expect(c.unitFullReason).toBeNull();
  });

  it('runs the whole suite when a config, lockfile or the schema changes (also when deleted)', () => {
    expect(planUnitTests({ classified: classifyChanges(['vitest.config.ts']), unitFull: false, fileReadingTests: [] })).toMatchObject({ mode: 'full', reason: 'zmiana vitest.config.ts' });
    expect(planUnitTests({ classified: classifyChanges(['prisma/schema.prisma']), unitFull: false, fileReadingTests: [] }).mode).toBe('full');
    expect(planUnitTests({ classified: classifyChanges([], ['tests/setup.ts']), unitFull: false, fileReadingTests: [] }).mode).toBe('full');
    expect(planUnitTests({ classified: classifyChanges(['app/x.ts']), unitFull: true, fileReadingTests: [] }).mode).toBe('full');
  });

  it('uses related tests plus every file-reading test, without listing a test twice', () => {
    const plan = planUnitTests({
      classified: classifyChanges(['lib/a.ts', 'tests/unit/static.test.ts']),
      unitFull: false,
      fileReadingTests: ['tests/unit/static.test.ts', 'tests/unit/other-static.test.ts'],
    });
    expect(plan).toMatchObject({ mode: 'related', related: ['lib/a.ts', 'tests/unit/static.test.ts'], always: ['tests/unit/other-static.test.ts'] });
  });

  it('still runs the file-reading tests when only docs changed', () => {
    const plan = planUnitTests({ classified: classifyChanges(['docs/a.md']), unitFull: false, fileReadingTests: ['tests/unit/s.test.ts'] });
    expect(plan).toMatchObject({ mode: 'none', always: ['tests/unit/s.test.ts'] });
  });

  it('lints changed files, the whole repo on config changes, nothing for docs', () => {
    expect(planLint({ classified: classifyChanges(['lib/a.ts', 'docs/a.md']), lintAll: false })).toMatchObject({ mode: 'changed', files: ['lib/a.ts'] });
    expect(planLint({ classified: classifyChanges(['eslint.config.mjs']), lintAll: false }).mode).toBe('all');
    expect(planLint({ classified: classifyChanges(['docs/a.md']), lintAll: false }).mode).toBe('none');
    expect(planLint({ classified: classifyChanges(['docs/a.md']), lintAll: true }).mode).toBe('all');
  });

  it('recognizes tests that read sources as text', () => {
    expect(isFileReadingTest("const src = readFileSync('app/x.tsx', 'utf8');")).toBe(true);
    expect(isFileReadingTest("import { readdirSync } from 'fs';")).toBe(true);
    expect(isFileReadingTest("import { render } from '@testing-library/react';")).toBe(false);
  });
});

describe('checkMigrations', () => {
  const base = ['20261004120000_a', '20261004180000_b'];
  const existing = base.map((dir) => ({ dir, bytes: utf8('CREATE TABLE "X" ();') }));

  it('accepts a new additive migration with a later timestamp', () => {
    const current = [...existing, { dir: '20261005090000_add_c', bytes: utf8('ALTER TABLE "X" ADD COLUMN "c" TEXT;') }];
    expect(checkMigrations({ current, baseDirs: base, changedFiles: ['prisma/migrations/20261005090000_add_c/migration.sql'] })).toEqual([]);
  });

  it('rejects a BOM, invalid UTF-8 and a bad name', () => {
    const current = [
      ...existing,
      { dir: '20261005090000_bom', bytes: new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('SELECT 1;')]) },
      { dir: '20261005090001_latin2', bytes: new Uint8Array([0x2d, 0x2d, 0x20, 0xb1]) },
      { dir: '2026_bad-name', bytes: utf8('SELECT 1;') },
    ];
    const problems = checkMigrations({ current, baseDirs: base, changedFiles: [] }).join('\n');
    expect(problems).toContain('20261005090000_bom/migration.sql: zaczyna sie od BOM');
    expect(problems).toContain('20261005090001_latin2/migration.sql: nie jest poprawnym UTF-8');
    expect(problems).toContain('2026_bad-name: nazwa nie pasuje');
  });

  it('grandfathers historical names that are already on the base', () => {
    const current = [{ dir: '0_init', bytes: utf8('CREATE TABLE "A" ();') }, ...existing];
    expect(checkMigrations({ current, baseDirs: ['0_init', ...base], changedFiles: [] })).toEqual([]);
  });

  it('rejects a new migration that sorts before the last one on the base', () => {
    const current = [...existing, { dir: '20261004170000_late', bytes: utf8('SELECT 1;') }];
    expect(checkMigrations({ current, baseDirs: base, changedFiles: [] })[0]).toContain('nie jest pozniejszy niz ostatnia migracja na bazie (20261004180000)');
  });

  it('rejects destructive SQL unless the migration carries the allow marker; comments do not count', () => {
    const drop = { dir: '20261005090000_drop', bytes: utf8('-- DROP TABLE in a comment is fine\nALTER TABLE "X" DROP COLUMN "c";') };
    expect(checkMigrations({ current: [...existing, drop], baseDirs: base, changedFiles: [] })[0]).toContain('operacja nieaddytywna (DROP COLUMN)');
    const allowed = { dir: drop.dir, bytes: utf8(`-- ${DESTRUCTIVE_ALLOW_MARKER} owner approved cleanup 2026-10-05\nALTER TABLE "X" DROP COLUMN "c";`) };
    expect(checkMigrations({ current: [...existing, allowed], baseDirs: base, changedFiles: [] })).toEqual([]);
    const commentOnly = { dir: drop.dir, bytes: utf8('/* DROP TABLE "Y" */ SELECT 1;') };
    expect(checkMigrations({ current: [...existing, commentOnly], baseDirs: base, changedFiles: [] })).toEqual([]);
  });

  it('rejects edits to or deletion of a migration that already exists on the base', () => {
    const problems = checkMigrations({
      current: [existing[0]],
      baseDirs: base,
      changedFiles: ['prisma\\migrations\\20261004120000_a\\migration.sql', 'prisma/migrations/20261004180000_b/migration.sql'],
    });
    expect(problems).toEqual([
      'prisma/migrations/20261004120000_a/migration.sql: zmieniono migracje, ktora jest juz na bazie (dodaj nowa zamiast edytowac)',
      '20261004180000_b: usunieto migracje, ktora jest juz na bazie',
    ]);
  });
});

describe('scheduling', () => {
  const g = (id: string, weight: number, deps: string[] = []) => ({ id, weight, deps });

  it('fills capacity in priority order and waits for dependencies', () => {
    const pending = [g('unit', 3, ['prisma']), g('typecheck', 1), g('lint', 1), g('hotspots', 1)];
    const picked = pickRunnable({ pending, running: [], finished: new Set<string>(), capacity: 4 });
    expect(picked.map((x) => x.id)).toEqual(['typecheck', 'lint', 'hotspots']);
  });

  it('starts a gate heavier than the machine when nothing else runs, and only then', () => {
    const build = g('build', 8);
    expect(pickRunnable({ pending: [build], running: [g('lint', 1)], finished: new Set(), capacity: 4 })).toEqual([]);
    expect(pickRunnable({ pending: [build], running: [], finished: new Set(), capacity: 4 })).toEqual([build]);
  });

  it('zero-weight gates never wait for capacity', () => {
    expect(pickRunnable({ pending: [g('migrations', 0)], running: [g('unit', 4)], finished: new Set(), capacity: 4 }).map((x) => x.id)).toEqual(['migrations']);
  });

  it('skips a gate whose dependency did not pass', () => {
    const results = new Map([['prisma', { status: STATUS.FAIL }]]);
    expect(blockedBy(g('unit', 3, ['prisma']), results)).toBe('zaleznosc prisma: FAIL');
    expect(blockedBy(g('lint', 1), results)).toBeNull();
  });
});

describe('verdict and report', () => {
  const results = [
    { id: 'lint', status: STATUS.PASS, durationMs: 1200, reason: 'ok' },
    { id: 'postgres', status: STATUS.SKIP, skipKind: 'env', durationMs: null, reason: 'Docker niedostepny' },
    { id: 'build', status: STATUS.SKIP, skipKind: 'mode', durationMs: null, reason: 'tylko z --build' },
  ];

  it('passes with environment skips, fails them only with --strict', () => {
    expect(summarize(results)).toMatchObject({ ok: true, exitCode: 0, counts: { pass: 1, fail: 0, skip: 2 } });
    expect(summarize(results, { strict: true })).toMatchObject({ ok: false, exitCode: 1, strictSkips: ['postgres'] });
  });

  it('fails when a required gate fails', () => {
    expect(summarize([...results, { id: 'unit', status: STATUS.FAIL, durationMs: 5, reason: 'x' }])).toMatchObject({ ok: false, exitCode: 1, failed: ['unit'] });
  });

  it('prints a table and a markdown summary with escaped pipes', () => {
    const table = formatTable(results);
    expect(table.split('\n')[0]).toMatch(/^bramka\s+wynik\s+czas\s+przyczyna$/);
    expect(table).toContain('1.2 s');
    const md = formatMarkdown({ ok: true, durationMs: 61_000, head: 'abc', dirty: false, base: 'def', node: 'v22', platform: 'linux', results: [{ id: 'x', status: 'PASS', durationMs: 5, reason: 'a | b' }] });
    expect(md).toContain('**PASS**, 1 min 1 s');
    expect(md).toContain('| x | PASS | 5 ms | a \\| b |');
  });
});

describe('output parsers', () => {
  it('summarizes a vitest JSON report', () => {
    const summary = parseVitestJson({
      numTotalTests: 10, numPassedTests: 8, numFailedTests: 1, numPendingTests: 1, numTodoTests: 0, numTotalTestSuites: 3, success: false,
      testResults: [
        { name: 'C:\\repo\\tests\\unit\\a.test.ts', status: 'failed' },
        { name: '/home/ci/repo/tests/unit/b.test.ts', status: 'passed' },
      ],
    });
    expect(summary).toMatchObject({ total: 10, failed: 1, skipped: 1, files: 2, failedFiles: ['tests/unit/a.test.ts'], success: false });
    expect(parseVitestJson(null)).toBeNull();
  });

  it('counts tsc errors and separates ignored prefixes', () => {
    const out = [
      "tests/unit/a.test.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      ".next/types/app/page.ts(1,1): error TS2307: Cannot find module.",
      'app\\x.tsx(9,1): error TS2554: Expected 1 arguments, but got 0.',
    ].join('\n');
    const parsed = parseTscOutput(out, ['.next/']);
    expect(parsed.relevant).toHaveLength(2);
    expect(parsed.ignored).toHaveLength(1);
    expect(parsed.files).toEqual(['tests/unit/a.test.ts', 'app/x.tsx']);
  });

  it('reads the eslint summary line', () => {
    expect(parseEslintSummary('\n✖ 12 problems (3 errors, 9 warnings)\n')).toEqual({ errors: 3, warnings: 9 });
    expect(parseEslintSummary('')).toEqual({ errors: 0, warnings: 0 });
  });
});
