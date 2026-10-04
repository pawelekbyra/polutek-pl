// Pure logic of the local CI runner (scripts/ops/local-ci.mjs): argument parsing, change
// classification, test selection, migration checks, scheduling and report formatting.
// No process spawning and no file system access here, so everything is unit-testable
// (tests/unit/ops/local-ci-lib.test.ts). Docs: docs/operations/LOCAL-CI.md.

export const STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', SKIP: 'SKIP' });

const HELP = `Lokalne CI (odpowiednik .github/workflows/ci.yml)

  node scripts/ops/local-ci.mjs [opcje]

  (domyslnie)        bramki jak w CI; lint i testy tylko dla zmian wzgledem origin/main
  --full             wszystko: lint calosci, caly zestaw testow, build i admin build
  --all              lint calosci (eslint .)
  --unit-full        caly zestaw testow jednostkowych
  --build            build i admin build (next build)
  --coverage         testy z --coverage (jak job tests/coverage)
  --strict           SKIP z braku narzedzia (Docker, siec, ffmpeg) liczy sie jako FAIL
  --only=a,b         tylko wskazane bramki (plus ich zaleznosci)
  --skip=a,b         pomin wskazane bramki
  --base=<ref>       punkt odniesienia dla zmian (domyslnie origin/main)
  --jobs=<n>         ile "slotow" CPU uzywac rownolegle (domyslnie liczba rdzeni)
  --list             wypisz bramki i wyjdz
  --help             ta pomoc
`;

export function helpText() {
  return HELP;
}

/** Parses CLI flags. Unknown flags are returned in `unknown` so the caller can fail loudly. */
export function parseArgs(argv) {
  const opts = {
    lintAll: false,
    unitFull: false,
    build: false,
    coverage: false,
    strict: false,
    only: [],
    skip: [],
    base: 'origin/main',
    jobs: null,
    list: false,
    help: false,
    unknown: [],
  };
  const csv = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);
  for (const arg of argv) {
    if (arg === '--full') Object.assign(opts, { lintAll: true, unitFull: true, build: true });
    else if (arg === '--all') opts.lintAll = true;
    else if (arg === '--unit-full') opts.unitFull = true;
    else if (arg === '--build') opts.build = true;
    else if (arg === '--coverage') opts.coverage = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--list') opts.list = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--only=')) opts.only = csv(arg.slice(7));
    else if (arg.startsWith('--skip=')) opts.skip = csv(arg.slice(7));
    else if (arg.startsWith('--base=')) opts.base = arg.slice(7);
    else if (arg.startsWith('--jobs=')) {
      const n = Number.parseInt(arg.slice(7), 10);
      if (Number.isFinite(n) && n > 0) opts.jobs = n;
      else opts.unknown.push(arg);
    } else opts.unknown.push(arg);
  }
  return opts;
}

/**
 * Reads the workflow-level `env:` block of a GitHub Actions file (flat `KEY: value` map only,
 * which is all ci.yml uses). Keeps local runs on the same fake values as CI, never on a real .env.
 */
export function parseWorkflowEnv(yamlText) {
  const env = {};
  const lines = yamlText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^env:\s*$/.test(line));
  if (start === -1) return env;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    const match = line.match(/^ {2}([A-Za-z_][A-Za-z0-9_]*):\s*(.*?)\s*$/);
    if (!match) break;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

/** Every `run:` command of a workflow, normalized (single line, collapsed spaces). */
export function parseWorkflowRuns(yamlText) {
  const runs = [];
  for (const line of yamlText.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:-\s+)?run:\s*(.+?)\s*$/);
    if (match && match[1] !== '|' && match[1] !== '>') runs.push(match[1].replace(/\s+/g, ' '));
  }
  return runs;
}

/** CI `run:` commands that local-ci does not reproduce (or does not need: npm ci, apt-get). */
export function uncoveredWorkflowRuns(runs, covered, ignored = []) {
  const known = new Set([...covered, ...ignored].map((cmd) => cmd.replace(/\s+/g, ' ')));
  return [...new Set(runs)].filter((cmd) => !known.has(cmd));
}

const LINT_EXT = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /^tests\/(?:unit|integration)\/.+\.test\.tsx?$/;
const SOURCE_FILE = /^(?:app|lib|components|apps|services|scripts|workers)\/.+\.(?:[cm]?[jt]sx?)$|^(?:middleware|instrumentation)\.ts$/;

// Changing any of these can change the result of any test, so the whole suite runs.
const UNIT_FULL_TRIGGERS = [
  /^package(?:-lock)?\.json$/,
  /^vitest(?:\.[a-z]+)?\.config\.[cm]?[jt]s$/,
  /^tsconfig(?:\.[a-z]+)?\.json$/,
  /^tests\/setup\.ts$/,
  /^tests\/(?:support|helpers|fixtures|mocks)\//,
  /^prisma\/schema\.prisma$/,
  /^\.nvmrc$/,
];
// Changing any of these can change lint results anywhere.
const LINT_ALL_TRIGGERS = [/^eslint\.config\.[cm]?js$/, /^package(?:-lock)?\.json$/, /^tsconfig\.json$/];

/** Normalizes git/OS paths to forward slashes relative to the repo root. */
export function toPosix(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Classifies changed paths (relative to repo root). `deleted` paths count for the "run everything"
 * triggers but are never handed to eslint or vitest (they no longer exist).
 */
export function classifyChanges(changed, deleted = []) {
  const files = [...new Set(changed.map(toPosix))].sort();
  const gone = [...new Set(deleted.map(toPosix))];
  const all = [...files, ...gone];
  return {
    files,
    deleted: gone,
    lintable: files.filter((f) => LINT_EXT.test(f) && !f.startsWith('apps/admin/.next/')),
    tests: files.filter((f) => TEST_FILE.test(f)),
    sources: files.filter((f) => SOURCE_FILE.test(f)),
    migrations: all.filter((f) => f.startsWith('prisma/migrations/')),
    unitFullReason: all.find((f) => UNIT_FULL_TRIGGERS.some((re) => re.test(f))) ?? null,
    lintAllReason: all.find((f) => LINT_ALL_TRIGGERS.some((re) => re.test(f))) ?? null,
  };
}

/**
 * Tests that read source files as text (fs.readFileSync/readdirSync, globs) are invisible to the
 * import graph `vitest related` walks, so in "changed" mode they always run. They are cheap.
 */
export function isFileReadingTest(content) {
  return /\breadFileSync\b|\breaddirSync\b|\bexistsSync\b|fs\/promises|\bglobSync\b|from ['"](?:fast-)?glob['"]/.test(content);
}

/**
 * Picks the unit-test plan.
 *  - full: whole suite (requested, or a config/schema/lockfile changed)
 *  - related: `vitest related` over changed sources+tests, plus every file-reading test
 *  - none: nothing relevant changed (only docs etc.); file-reading tests still run
 */
export function planUnitTests({ classified, unitFull, fileReadingTests }) {
  if (unitFull) return { mode: 'full', reason: 'wymuszone (--full/--unit-full)', related: [], always: [] };
  if (classified.unitFullReason) {
    return { mode: 'full', reason: `zmiana ${classified.unitFullReason}`, related: [], always: [] };
  }
  const related = [...new Set([...classified.sources, ...classified.tests])].sort();
  const always = [...new Set(fileReadingTests.map(toPosix))].filter((f) => !related.includes(f)).sort();
  if (related.length === 0) {
    return { mode: 'none', reason: 'brak zmienionych zrodel i testow', related: [], always };
  }
  return { mode: 'related', reason: `${related.length} zmienionych plikow`, related, always };
}

/** Lint plan: whole repo or only changed lintable files. */
export function planLint({ classified, lintAll }) {
  if (lintAll) return { mode: 'all', reason: 'wymuszone (--all/--full)', files: [] };
  if (classified.lintAllReason) return { mode: 'all', reason: `zmiana ${classified.lintAllReason}`, files: [] };
  if (classified.lintable.length === 0) return { mode: 'none', reason: 'brak zmienionych plikow JS/TS', files: [] };
  return { mode: 'changed', reason: `${classified.lintable.length} zmienionych plikow`, files: classified.lintable };
}

const MIGRATION_DIR = /^(\d{14})_([a-z0-9_]+)$/;
const DESTRUCTIVE_SQL = [
  /\bDROP\s+(?:TABLE|COLUMN|SCHEMA|TYPE|INDEX|CONSTRAINT|VIEW|FUNCTION|TRIGGER|EXTENSION)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\b[^;]*\bRENAME\b/i,
  /\bALTER\s+TYPE\b[^;]*\bRENAME\b/i,
  /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i,
];
// A cleanup migration that the owner approved must say so in its own SQL (CLAUDE.md: additive by default).
export const DESTRUCTIVE_ALLOW_MARKER = 'local-ci: allow-destructive';

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

function isValidUtf8(bytes) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks prisma/migrations against the base branch.
 *  - every migration.sql: UTF-8, no BOM (a BOM broke a production deploy on 2026-09-30)
 *  - new directory names: <14-digit timestamp>_<snake_case> (old ones such as 0_init are grandfathered)
 *  - new migrations: timestamp later than every migration on the base (Prisma applies by name order)
 *  - new migrations: additive only, unless the SQL carries the allow marker
 *  - existing migrations: never modified or deleted (already applied in production)
 *
 * @param {object} input
 * @param {Array<{dir:string, bytes:Uint8Array|null}>} input.current migration dirs in the working tree
 * @param {string[]} input.baseDirs migration dir names on the base ref
 * @param {string[]} input.changedFiles changed paths under prisma/migrations (vs base, incl. deleted)
 */
export function checkMigrations({ current, baseDirs, changedFiles }) {
  const problems = [];
  const baseSet = new Set(baseDirs);
  const maxBase = baseDirs
    .map((dir) => dir.match(MIGRATION_DIR)?.[1])
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const currentSet = new Set(current.map((m) => m.dir));

  for (const { dir, bytes } of current) {
    const isNew = !baseSet.has(dir);
    const match = dir.match(MIGRATION_DIR);
    // Historical names (e.g. 0_init) are grandfathered: renaming an applied migration breaks _prisma_migrations.
    if (isNew && !match) problems.push(`${dir}: nazwa nie pasuje do <14 cyfr>_<snake_case>`);
    if (!bytes) {
      problems.push(`${dir}: brak migration.sql`);
      continue;
    }
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      problems.push(`${dir}/migration.sql: zaczyna sie od BOM (zapisz jako UTF-8 bez BOM)`);
    }
    if (!isValidUtf8(bytes)) problems.push(`${dir}/migration.sql: nie jest poprawnym UTF-8`);

    if (isNew) {
      if (match && maxBase && match[1] <= maxBase) {
        problems.push(`${dir}: znacznik czasu ${match[1]} nie jest pozniejszy niz ostatnia migracja na bazie (${maxBase})`);
      }
      const sql = new TextDecoder('utf-8').decode(bytes);
      if (!sql.includes(DESTRUCTIVE_ALLOW_MARKER)) {
        const code = stripSqlComments(sql);
        const hit = DESTRUCTIVE_SQL.find((re) => re.test(code));
        if (hit) {
          problems.push(`${dir}: operacja nieaddytywna (${code.match(hit)[0].replace(/\s+/g, ' ')}); migracja czyszczaca wymaga komentarza "-- ${DESTRUCTIVE_ALLOW_MARKER} <powod>"`);
        }
      }
    }
  }

  for (const file of changedFiles.map(toPosix)) {
    const dir = file.split('/')[2];
    if (!dir || !baseSet.has(dir)) continue;
    if (!currentSet.has(dir)) problems.push(`${dir}: usunieto migracje, ktora jest juz na bazie`);
    else problems.push(`${file}: zmieniono migracje, ktora jest juz na bazie (dodaj nowa zamiast edytowac)`);
  }
  return [...new Set(problems)];
}

/**
 * Chooses which pending gates can start now. A gate starts when all its dependencies finished and
 * its weight fits in the free capacity; when nothing is running, the first ready gate always starts
 * (so a gate heavier than the machine still runs, alone). Order of `pending` is the priority.
 */
export function pickRunnable({ pending, running, finished, capacity }) {
  let used = running.reduce((sum, gate) => sum + gate.weight, 0);
  let busy = running.length;
  const picked = [];
  for (const gate of pending) {
    const depsDone = (gate.deps ?? []).every((dep) => finished.has(dep));
    if (!depsDone) continue;
    if (busy === 0 || used + gate.weight <= capacity) {
      picked.push(gate);
      used += gate.weight;
      busy += 1;
    }
  }
  return picked;
}

/** A gate whose dependency did not pass is skipped with that reason instead of being run. */
export function blockedBy(gate, results) {
  for (const dep of gate.deps ?? []) {
    const result = results.get(dep);
    if (result && result.status !== STATUS.PASS) return `zaleznosc ${dep}: ${result.status}`;
  }
  return null;
}

/** Overall verdict. Required FAILs fail the run; with `strict`, environment SKIPs fail too. */
export function summarize(results, { strict = false } = {}) {
  const failed = results.filter((r) => r.status === STATUS.FAIL && r.required !== false);
  const strictSkips = strict ? results.filter((r) => r.status === STATUS.SKIP && r.skipKind === 'env') : [];
  const ok = failed.length === 0 && strictSkips.length === 0;
  return {
    ok,
    exitCode: ok ? 0 : 1,
    failed: failed.map((r) => r.id),
    strictSkips: strictSkips.map((r) => r.id),
    counts: {
      pass: results.filter((r) => r.status === STATUS.PASS).length,
      fail: results.filter((r) => r.status === STATUS.FAIL).length,
      skip: results.filter((r) => r.status === STATUS.SKIP).length,
    },
  };
}

export function formatDuration(ms) {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}

/** Plain-text table for the terminal. */
export function formatTable(results) {
  const rows = results.map((r) => [r.id, r.status, formatDuration(r.durationMs), r.reason ?? '']);
  const header = ['bramka', 'wynik', 'czas', 'przyczyna'];
  const widths = [0, 1, 2].map((i) => Math.max(header[i].length, ...rows.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => (i < 3 ? c.padEnd(widths[i]) : c)).join('  ').trimEnd();
  return [line(header), line(widths.map((w) => '-'.repeat(w)).concat('-'.repeat(9))), ...rows.map(line)].join('\n');
}

/** Markdown summary (used as the squash-merge body by scripts/ops/mergedeploy.sh LOCAL_CI=1). */
export function formatMarkdown(report) {
  const verdict = report.ok ? 'PASS' : 'FAIL';
  const lines = [
    `Lokalne CI (scripts/ops/local-ci.mjs): **${verdict}**, ${formatDuration(report.durationMs)}`,
    `HEAD \`${report.head}\`${report.dirty ? ' (z niezatwierdzonymi zmianami)' : ''}, baza \`${report.base ?? '-'}\`, Node ${report.node}, ${report.platform}`,
    '',
    '| bramka | wynik | czas | przyczyna |',
    '|---|---|---|---|',
    ...report.results.map((r) => `| ${r.id} | ${r.status} | ${formatDuration(r.durationMs)} | ${(r.reason ?? '').replace(/\|/g, '\\|')} |`),
  ];
  return lines.join('\n');
}

/** Summary of a Vitest JSON report (`--reporter=json`). */
export function parseVitestJson(json) {
  if (!json || typeof json !== 'object') return null;
  const failedFiles = (json.testResults ?? [])
    .filter((file) => file.status === 'failed')
    .map((file) => toPosix(String(file.name ?? '')).replace(/^.*?(?=tests\/)/, ''));
  return {
    total: json.numTotalTests ?? 0,
    passed: json.numPassedTests ?? 0,
    failed: json.numFailedTests ?? 0,
    skipped: (json.numPendingTests ?? 0) + (json.numTodoTests ?? 0),
    files: (json.testResults ?? []).length,
    failedFiles,
    success: json.success === true,
  };
}

/** Counts TypeScript errors, split into errors under ignored path prefixes (e.g. .next/) and the rest. */
export function parseTscOutput(text, ignoredPrefixes = []) {
  const errors = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+):/);
    if (match) errors.push({ file: toPosix(match[1]), code: match[2], line });
  }
  const ignored = errors.filter((e) => ignoredPrefixes.some((p) => e.file.startsWith(p)));
  const relevant = errors.filter((e) => !ignored.includes(e));
  return { relevant, ignored, files: [...new Set(relevant.map((e) => e.file))] };
}

/** "✖ 12 problems (3 errors, 9 warnings)" → { errors: 3, warnings: 9 } */
export function parseEslintSummary(text) {
  const match = text.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);
  if (!match) return { errors: 0, warnings: 0 };
  return { errors: Number(match[2]), warnings: Number(match[3]) };
}

/** Last non-empty lines of a command output, for the failure reason. */
export function tail(text, n = 1) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim())
    .filter(Boolean)
    .slice(-n)
    .join(' | ');
}
