#!/usr/bin/env node
// Local CI: runs the same gates as .github/workflows/ci.yml on this machine (Windows or Linux),
// so a branch can be merged safely when GitHub Actions is unavailable.
//
//   node scripts/ops/local-ci.mjs            # gates for the changes vs origin/main
//   node scripts/ops/local-ci.mjs --full     # everything, incl. the whole test suite and builds
//   node scripts/ops/local-ci.mjs --help
//
// Result: a PASS/FAIL/SKIP table, exit code 0 only when every required gate passed, a JSON report
// in .claude/local-ci-last.json (+ .md summary) and per-gate logs in .claude/local-ci-logs/.
// Child processes get the workflow-level env of ci.yml (fake values), never the local .env secrets.
// Docs: docs/operations/LOCAL-CI.md. Pure logic: scripts/ops/local-ci-lib.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STATUS,
  blockedBy,
  checkMigrations,
  classifyChanges,
  formatDuration,
  formatMarkdown,
  formatTable,
  helpText,
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
  tail,
  toPosix,
  uncoveredWorkflowRuns,
} from './local-ci-lib.mjs';

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  process.stdout.write(helpText());
  process.exit(0);
}
if (opts.unknown.length) {
  console.error(`Nieznane opcje: ${opts.unknown.join(' ')}\n`);
  process.stdout.write(helpText());
  process.exit(2);
}

const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

const ROOT = git('rev-parse', '--show-toplevel').out || process.cwd();
process.chdir(ROOT);
const OUT_DIR = path.join(ROOT, '.claude');
const LOG_DIR = path.join(OUT_DIR, 'local-ci-logs');
const REPORT_JSON = path.join(OUT_DIR, 'local-ci-last.json');
const REPORT_MD = path.join(OUT_DIR, 'local-ci-last.md');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const CPUS = Math.max(1, os.availableParallelism?.() ?? os.cpus().length);
const CAPACITY = opts.jobs ?? CPUS;

// ---------------------------------------------------------------------------------------------
// Context: HEAD, base, changed files, CI env.

const head = git('rev-parse', 'HEAD').out;
const branch = git('rev-parse', '--abbrev-ref', 'HEAD').out;
const dirty = git('status', '--porcelain', '--untracked-files=no').out !== '';
const baseRef = opts.base;
const mergeBase = git('merge-base', 'HEAD', baseRef);
const base = mergeBase.ok ? mergeBase.out : null;

function changedFiles() {
  if (!base) return { changed: [], deleted: [] };
  const diff = git('diff', '--name-status', '--no-renames', base).out;
  const untracked = git('ls-files', '--others', '--exclude-standard').out;
  const changed = [];
  const deleted = [];
  for (const line of diff.split('\n').filter(Boolean)) {
    const [status, file] = line.split('\t');
    (status.startsWith('D') ? deleted : changed).push(file);
  }
  changed.push(...untracked.split('\n').filter(Boolean));
  return { changed, deleted };
}

const { changed, deleted } = changedFiles();
const classified = classifyChanges(changed, deleted);
const workflowText = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, 'utf8') : '';
const ciEnv = parseWorkflowEnv(workflowText);
const childEnv = { ...process.env, ...ciEnv, CI: 'true', FORCE_COLOR: '0', NO_COLOR: '1' };

function bin(pkg, name = pkg) {
  const pkgJsonPath = path.join(ROOT, 'node_modules', pkg, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const rel = typeof pkgJson.bin === 'string' ? pkgJson.bin : pkgJson.bin?.[name];
  if (!rel) throw new Error(`brak pliku wykonywalnego ${name} w ${pkg}`);
  return path.join(ROOT, 'node_modules', pkg, rel);
}

// ---------------------------------------------------------------------------------------------
// Process helpers. No shell: file paths such as app/[locale]/... must reach the tools verbatim.

const children = new Set();

function run(gateId, label, command, args, { env = childEnv, timeoutMs = 60 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    const logPath = path.join(LOG_DIR, `${gateId}.log`);
    const header = `\n$ ${[command, ...args].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}\n`;
    let output = '';
    const child = spawn(command, args, { cwd: ROOT, env, windowsHide: true });
    children.add(child);
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    const onData = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const finish = (code) => {
      clearTimeout(timer);
      children.delete(child);
      writeFileSync(logPath, `${header}${output}\n[exit ${code}]\n`, { flag: 'a' });
      resolve({ code, output, label });
    };
    child.on('error', (error) => {
      output += `\n${error.message}`;
      finish(127);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

const node = (gateId, label, script, args, options) => run(gateId, label, process.execPath, [script, ...args], options);
const tsx = (gateId, label, args, options) => node(gateId, label, bin('tsx'), args, options);

function commandWorks(command, args, timeoutMs = 15000) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  return r.status === 0;
}

// Runs steps in order, stops at the first failing one.
async function steps(gateId, list) {
  for (const [label, command, args, options] of list) {
    const r = await run(gateId, label, command, args, options);
    if (r.code !== 0) return { status: STATUS.FAIL, reason: `${label}: ${tail(r.output) || `kod ${r.code}`}` };
  }
  return { status: STATUS.PASS, reason: list.map(([label]) => label).join(', ') };
}

const pass = (reason) => ({ status: STATUS.PASS, reason });
const fail = (reason) => ({ status: STATUS.FAIL, reason });
const skip = (reason, skipKind = 'mode') => ({ status: STATUS.SKIP, reason, skipKind });

// ---------------------------------------------------------------------------------------------
// Gates. Order = priority. weight = CPU slots the gate occupies (capacity = cores).

const LOCAL_ONLY_CI_RUNS = ['npm ci', 'sudo apt-get update && sudo apt-get install -y --no-install-recommends ffmpeg'];

const gates = [
  {
    id: 'prisma',
    title: 'Prisma validation/generation',
    ci: ['npx prisma validate', 'npx prisma generate'],
    weight: 1,
    run: () => steps('prisma', [
      ['prisma validate', process.execPath, [bin('prisma'), 'validate']],
      ['prisma generate', process.execPath, [bin('prisma'), 'generate']],
    ]),
  },
  {
    id: 'ci-parity',
    title: 'zgodnosc z ci.yml',
    weight: 0,
    run: async () => {
      if (!workflowText) return fail('brak .github/workflows/ci.yml');
      const covered = gates.flatMap((g) => g.ci ?? []);
      const missing = uncoveredWorkflowRuns(parseWorkflowRuns(workflowText), covered, LOCAL_ONLY_CI_RUNS);
      return missing.length
        ? fail(`ci.yml ma kroki nieobslugiwane lokalnie: ${missing.join('; ')} (dopisz je do local-ci.mjs)`)
        : pass(`${Object.keys(ciEnv).length} zmiennych env z ci.yml, wszystkie kroki odwzorowane`);
    },
  },
  {
    id: 'migrations',
    title: 'migracje (UTF-8 bez BOM, addytywne, rosnace znaczniki)',
    weight: 0,
    run: async () => {
      const dir = path.join(ROOT, 'prisma', 'migrations');
      const current = readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
          const sql = path.join(dir, d.name, 'migration.sql');
          return { dir: d.name, bytes: existsSync(sql) ? readFileSync(sql) : null };
        });
      const baseList = base ? git('ls-tree', '--name-only', `${base}:prisma/migrations`) : { ok: false, out: '' };
      const baseDirs = baseList.ok ? baseList.out.split('\n').filter((n) => n && !n.includes('.')) : [];
      const problems = checkMigrations({ current, baseDirs, changedFiles: classified.migrations });
      if (problems.length) return fail(problems.join('; '));
      const added = current.filter((m) => !baseDirs.includes(m.dir)).length;
      return pass(`${current.length} migracji, nowych: ${base ? added : '? (brak bazy)'}`);
    },
  },
  {
    id: 'unit',
    title: 'tests/coverage (vitest)',
    ci: ['npm run test:coverage'],
    weight: Math.max(1, CAPACITY - 1),
    deps: ['prisma'],
    run: async () => {
      const fileReadingTests = listTestFiles().filter((f) => isFileReadingTest(readFileSync(path.join(ROOT, f), 'utf8')));
      const plan = planUnitTests({ classified, unitFull: opts.unitFull || !base, fileReadingTests });
      const vitest = bin('vitest');
      const jsonPath = path.join(LOG_DIR, 'unit.vitest.json');
      const common = ['--reporter=dot', '--reporter=json', `--outputFile.json=${jsonPath}`, `--maxWorkers=${Math.max(1, CAPACITY - 1)}`];
      if (opts.coverage) common.push('--coverage');
      let args;
      if (plan.mode === 'full') args = ['run', ...common];
      else if (plan.mode === 'related') args = ['related', ...plan.related, '--run', '--passWithNoTests', ...common];
      else args = ['run', ...plan.always, '--passWithNoTests', ...common];
      rmSync(jsonPath, { force: true });
      const r = await node('unit', 'vitest', vitest, args);
      let summary = null;
      try {
        summary = parseVitestJson(JSON.parse(readFileSync(jsonPath, 'utf8')));
      } catch {
        // no JSON (crash before the reporter ran): fall back to the exit code and the output tail
      }
      // `vitest related` cannot be combined with a file list: run the file-reading tests separately.
      let extra = null;
      if (plan.mode === 'related' && plan.always.length && r.code === 0) {
        const extraJson = path.join(LOG_DIR, 'unit-static.vitest.json');
        rmSync(extraJson, { force: true });
        const r2 = await node('unit', 'vitest (testy czytajace zrodla)', vitest, ['run', ...plan.always, '--reporter=dot', '--reporter=json', `--outputFile.json=${extraJson}`, `--maxWorkers=${Math.max(1, CAPACITY - 1)}`]);
        try {
          extra = { code: r2.code, summary: parseVitestJson(JSON.parse(readFileSync(extraJson, 'utf8'))), output: r2.output };
        } catch {
          extra = { code: r2.code, summary: null, output: r2.output };
        }
      }
      const describe = (s) => (s ? `${s.files} plikow, ${s.total} testow, ${s.failed} nieudanych, ${s.skipped} pominietych` : 'brak raportu JSON');
      const scope = plan.mode === 'full' ? 'caly zestaw' : plan.mode === 'related' ? `related (${plan.reason}) + ${plan.always.length} czytajacych zrodla` : `tylko ${plan.always.length} czytajacych zrodla (${plan.reason})`;
      const failures = [summary, extra?.summary].filter(Boolean).flatMap((s) => s.failedFiles);
      if (r.code !== 0 || (extra && extra.code !== 0)) {
        const why = failures.length ? `nieudane: ${failures.slice(0, 5).join(', ')}${failures.length > 5 ? ` (+${failures.length - 5})` : ''}` : tail(extra?.output ?? r.output);
        return fail(`${scope}; ${describe(summary)}${extra ? ` + ${describe(extra.summary)}` : ''}; ${why}`);
      }
      return pass(`${scope}; ${describe(summary)}${extra ? ` + ${describe(extra.summary)}` : ''}`);
    },
  },
  {
    id: 'typecheck',
    title: 'typecheck (tsconfig.typecheck.json)',
    ci: ['npx tsc -p tsconfig.typecheck.json --noEmit'],
    weight: 1,
    deps: ['prisma'],
    run: async () => {
      const r = await node('typecheck', 'tsc', bin('typescript', 'tsc'), ['-p', 'tsconfig.typecheck.json', '--noEmit']);
      if (r.code === 0) return pass('0 bledow');
      const { relevant, ignored } = parseTscOutput(r.output, ['.next/']);
      if (relevant.length === 0 && ignored.length) return fail(`${ignored.length} bledow tylko w .next/ (stary build? usun .next)`);
      return fail(`${relevant.length} bledow w: ${parseTscOutput(r.output).files.slice(0, 4).join(', ') || tail(r.output)}`);
    },
  },
  {
    id: 'typecheck-all',
    title: 'typecheck calego repo z testami (tsconfig.json, bez .next/)',
    weight: 1,
    deps: ['prisma'],
    run: async () => {
      const r = await node('typecheck-all', 'tsc', bin('typescript', 'tsc'), ['-p', 'tsconfig.json', '--noEmit']);
      const { relevant, ignored, files } = parseTscOutput(r.output, ['.next/']);
      if (relevant.length === 0 && (r.code === 0 || ignored.length)) return pass(`0 bledow${ignored.length ? ` (pominieto ${ignored.length} w .next/)` : ''}`);
      return fail(relevant.length ? `${relevant.length} bledow w: ${files.slice(0, 4).join(', ')}` : tail(r.output));
    },
  },
  {
    id: 'lint',
    title: 'lint (eslint)',
    ci: ['npm run lint'],
    weight: 1,
    run: async () => {
      const plan = planLint({ classified, lintAll: opts.lintAll || !base });
      if (plan.mode === 'none') return pass(`nic do sprawdzenia (${plan.reason})`);
      const files = plan.mode === 'all' ? ['.'] : plan.files.filter((f) => existsSync(path.join(ROOT, f)));
      // --cache only skips re-linting unchanged files between local runs; results are the same as without it.
      const cache = ['--cache', '--cache-strategy', 'content', '--cache-location', path.join(OUT_DIR, 'local-ci-cache', 'eslint')];
      const r = await node('lint', 'eslint', bin('eslint'), ['--no-warn-ignored', ...cache, ...files]);
      const { errors, warnings } = parseEslintSummary(r.output);
      const scope = plan.mode === 'all' ? 'cale repo' : `${files.length} zmienionych plikow`;
      if (r.code !== 0) return fail(`${scope}: ${errors} bledow, ${warnings} ostrzezen`);
      return pass(`${scope} (${plan.reason}): 0 bledow, ${warnings} ostrzezen`);
    },
  },
  {
    id: 'architecture',
    title: 'architecture boundaries',
    ci: ['npm run quality:architecture-boundaries'],
    weight: 1,
    run: async () => {
      const r = await tsx('architecture', 'check-architecture', ['scripts/check-architecture.ts']);
      return r.code === 0 ? pass('0 naruszen') : fail(tail(r.output));
    },
  },
  {
    id: 'hotspots',
    title: 'hotspots',
    ci: ['npm run quality:hotspots'],
    weight: 1,
    run: async () => {
      const r = await tsx('hotspots', 'check-hotspots', ['scripts/check-hotspots.ts']);
      return r.code === 0 ? pass(tail(r.output)) : fail(tail(r.output, 2));
    },
  },
  {
    id: 'strict-escapes',
    title: 'strict escapes',
    ci: ['npm run quality:strict-escapes'],
    weight: 1,
    run: async () => {
      const r = await tsx('strict-escapes', 'check-strict-escapes', ['scripts/check-strict-escapes.ts']);
      return r.code === 0 ? pass(tail(r.output)) : fail(tail(r.output, 2));
    },
  },
  {
    id: 'env',
    title: 'environment validation',
    ci: ['npm run env:validate:prod'],
    weight: 1,
    run: async () => {
      const r = await tsx('env', 'validate-env', ['scripts/validate-env.ts', '--mode=production']);
      return r.code === 0 ? pass('env z ci.yml przechodzi walidacje produkcyjna') : fail(tail(r.output, 2));
    },
  },
  {
    id: 'audit',
    title: 'npm audit/security',
    ci: ['npm run audit:high'],
    weight: 1,
    run: async () => {
      try {
        await Promise.race([lookup('registry.npmjs.org'), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))]);
      } catch {
        return skip('brak sieci (registry.npmjs.org nie odpowiada)', 'env');
      }
      const r = await node('audit', 'audit-high', path.join(ROOT, 'scripts', 'audit-high.mjs'), []);
      if (/did not produce a parseable report/.test(r.output)) return skip('npm audit niedostepny (siec/rejestr)', 'env');
      const lines = r.output.split(/\r?\n/).filter((l) => l.includes('[audit:high]')).join('\n');
      return r.code === 0 ? pass(tail(lines || r.output)) : fail(tail(lines || r.output, 2));
    },
  },
  {
    id: 'postgres',
    title: 'integration-postgres (tymczasowy kontener)',
    ci: ['npm run test:integration:postgres'],
    weight: 1,
    deps: ['prisma'],
    run: runPostgresGate,
  },
  {
    id: 'encode-smoke',
    title: 'encode-smoke (ffmpeg)',
    ci: ['npx vitest run tests/unit/hls/encode-hls.ffmpeg.test.ts'],
    weight: 1,
    deps: ['prisma'],
    run: async () => {
      if (!commandWorks('ffmpeg', ['-version']) || !commandWorks('ffprobe', ['-version'])) return skip('brak ffmpeg/ffprobe w PATH', 'env');
      const r = await node('encode-smoke', 'vitest', bin('vitest'), ['run', 'tests/unit/hls/encode-hls.ffmpeg.test.ts'], { env: { ...childEnv, ENCODE_SMOKE: '1' } });
      return r.code === 0 ? pass('prawdziwy ffmpeg: OK') : fail(tail(r.output, 2));
    },
  },
  {
    id: 'build',
    title: 'build (next build)',
    ci: ['npm run build'],
    weight: CAPACITY,
    deps: ['typecheck'],
    when: () => (opts.build ? null : 'tylko z --build/--full'),
    run: async () => {
      const r = await node('build', 'next build', bin('next'), ['build']);
      return r.code === 0 ? pass('next build OK') : fail(tail(r.output, 2));
    },
  },
  {
    id: 'admin-build',
    title: 'admin build (apps/admin)',
    ci: ['npm run admin:build'],
    weight: CAPACITY,
    deps: ['build'],
    when: () => (opts.build ? null : 'tylko z --build/--full'),
    run: async () => {
      const r = await node('admin-build', 'next build apps/admin', bin('next'), ['build', 'apps/admin'], { env: { ...childEnv, NEXT_OUTPUT: 'standalone' } });
      return r.code === 0 ? pass('next build apps/admin OK') : fail(tail(r.output, 2));
    },
  },
];

function listTestFiles() {
  const out = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'tests/unit', 'tests/integration').out;
  return out.split('\n').filter((f) => /\.test\.tsx?$/.test(f) && existsSync(path.join(ROOT, f))).map(toPosix);
}

async function runPostgresGate() {
  if (!commandWorks('docker', ['info'], 20000)) return skip('Docker niedostepny (docker info nie dziala)', 'env');
  const image = process.env.LOCAL_CI_PG_IMAGE || 'postgres:16'; // ci.yml uses postgres:16 (production runs 17)
  const name = `local-ci-pg-${process.pid}`;
  const started = await run('postgres', 'docker run', 'docker', ['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_USER=ci', '-e', 'POSTGRES_PASSWORD=ci', '-e', 'POSTGRES_DB=ci', '-p', '127.0.0.1::5432', image]);
  if (started.code !== 0) return fail(`docker run: ${tail(started.output)}`);
  cleanup.add(() => spawnSync('docker', ['rm', '-f', name], { windowsHide: true }));
  try {
    const port = spawnSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).stdout?.trim().split('\n')[0]?.split(':').at(-1);
    if (!port) return fail('nie udalo sie odczytac portu kontenera');
    let ready = false;
    for (let i = 0; i < 60 && !ready; i += 1) {
      ready = commandWorks('docker', ['exec', name, 'pg_isready', '-U', 'ci', '-d', 'ci', '-h', '127.0.0.1']);
      if (!ready) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) return fail('Postgres nie wstal w 60 s');
    const url = `postgresql://ci:ci@127.0.0.1:${port}/ci`;
    const env = { ...childEnv, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
    // Same as `npm run test:integration:postgres`, minus the second `prisma generate` (done by the
    // prisma gate with the same schema; regenerating here would race the running unit tests).
    const result = await steps('postgres', [
      ['prisma migrate deploy', process.execPath, [bin('prisma'), 'migrate', 'deploy'], { env }],
      ['db:smoke', process.execPath, [bin('tsx'), 'scripts/db-smoke.ts'], { env }],
      ['vitest postgres', process.execPath, [bin('vitest'), 'run', '--config', 'vitest.postgres.config.ts', '--reporter=dot'], { env }],
    ]);
    return { ...result, reason: `${image}: ${result.reason}` };
  } finally {
    spawnSync('docker', ['rm', '-f', name], { windowsHide: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Selection, scheduling, report.

const cleanup = new Set();
function killAll() {
  for (const child of children) child.kill('SIGTERM');
  for (const fn of cleanup) fn();
}
process.on('SIGINT', () => {
  console.error('\nPrzerwano: zatrzymuje bramki i sprzatam.');
  killAll();
  process.exit(130);
});

if (opts.list) {
  for (const gate of gates) console.log(`${gate.id.padEnd(15)} ${gate.title}${gate.ci ? `   [ci: ${gate.ci.join(' && ')}]` : ''}`);
  process.exit(0);
}

const known = new Set(gates.map((g) => g.id));
const badNames = [...opts.only, ...opts.skip].filter((id) => !known.has(id));
if (badNames.length) {
  console.error(`Nieznane bramki: ${badNames.join(', ')} (zobacz --list)`);
  process.exit(2);
}
// --only keeps the listed gates plus everything they depend on.
const selected = new Set(opts.only.length ? opts.only : gates.map((g) => g.id));
for (let grew = true; grew;) {
  grew = false;
  for (const gate of gates) {
    if (!selected.has(gate.id)) continue;
    for (const dep of gate.deps ?? []) if (!selected.has(dep)) { selected.add(dep); grew = true; }
  }
}

if (!existsSync(path.join(ROOT, 'node_modules', '.bin'))) {
  console.error('Brak node_modules: uruchom najpierw `npm ci`.');
  process.exit(2);
}

mkdirSync(LOG_DIR, { recursive: true });
for (const f of readdirSync(LOG_DIR)) rmSync(path.join(LOG_DIR, f), { force: true });

const startedAt = new Date();
const t0 = Date.now();
console.log(`Lokalne CI: ${branch} @ ${head.slice(0, 12)}${dirty ? ' (+ niezatwierdzone zmiany)' : ''}, baza ${base ? `${baseRef} (${base.slice(0, 12)})` : `BRAK (${baseRef}): tryb pelny`}`);
console.log(`Zmienione pliki: ${classified.files.length} (+${classified.deleted.length} usunietych), sloty CPU: ${CAPACITY}, Node ${process.version}${process.version.startsWith('v22.') ? '' : ' (CI uzywa Node 22 z .nvmrc)'}`);
console.log(`Logi bramek: ${toPosix(path.relative(ROOT, LOG_DIR))}/\n`);

const results = new Map();
const pending = [];
for (const gate of gates) {
  if (!selected.has(gate.id) || opts.skip.includes(gate.id)) {
    results.set(gate.id, { id: gate.id, title: gate.title, ...skip(opts.skip.includes(gate.id) ? 'pominieta (--skip)' : 'nie wybrana (--only)'), durationMs: null });
    continue;
  }
  const notNow = gate.when?.();
  if (notNow) {
    results.set(gate.id, { id: gate.id, title: gate.title, ...skip(notNow), durationMs: null });
    continue;
  }
  pending.push(gate);
}

// Skipped-by-choice gates count as "finished" for dependants (e.g. --skip=typecheck still lets build run).
const finished = new Set([...results.keys()]);
const depResults = new Map([...results].filter(([, r]) => r.reason !== 'pominieta (--skip)' && !String(r.reason).startsWith('nie wybrana')));

await new Promise((resolveAll) => {
  const running = [];
  const tick = () => {
    // Gates whose dependency failed are skipped straight away.
    for (const gate of [...pending]) {
      if ((gate.deps ?? []).every((d) => finished.has(d))) {
        const blocked = blockedBy(gate, depResults);
        if (blocked) {
          pending.splice(pending.indexOf(gate), 1);
          const r = { id: gate.id, title: gate.title, ...skip(`pominieta: ${blocked}`, 'dep'), durationMs: null };
          results.set(gate.id, r);
          depResults.set(gate.id, r);
          finished.add(gate.id);
          console.log(`- ${gate.id}: SKIP (${blocked})`);
        }
      }
    }
    if (pending.length === 0 && running.length === 0) return resolveAll();
    for (const gate of pickRunnable({ pending, running, finished, capacity: CAPACITY })) {
      pending.splice(pending.indexOf(gate), 1);
      running.push(gate);
      const started = Date.now();
      console.log(`> ${gate.id}: start (${gate.title})`);
      Promise.resolve()
        .then(() => gate.run())
        .catch((error) => fail(`blad local-ci: ${error.message}`))
        .then((outcome) => {
          const r = { id: gate.id, title: gate.title, required: true, ...outcome, durationMs: Date.now() - started };
          results.set(gate.id, r);
          depResults.set(gate.id, r);
          finished.add(gate.id);
          running.splice(running.indexOf(gate), 1);
          console.log(`${r.status === STATUS.PASS ? '+' : r.status === STATUS.FAIL ? 'X' : '-'} ${gate.id}: ${r.status} ${formatDuration(r.durationMs)}${r.status === STATUS.PASS ? '' : ` (${r.reason})`}`);
          tick();
        });
    }
  };
  tick();
});

const ordered = gates.map((g) => results.get(g.id));
const verdict = summarize(ordered, { strict: opts.strict });
const report = {
  ok: verdict.ok,
  head,
  branch,
  dirty,
  base,
  baseRef,
  node: process.version,
  platform: `${process.platform} ${os.release()}`,
  cpus: CPUS,
  options: { ...opts, unknown: undefined },
  changedFiles: classified.files.length,
  startedAt: startedAt.toISOString(),
  durationMs: Date.now() - t0,
  failed: verdict.failed,
  strictSkips: verdict.strictSkips,
  results: ordered.map(({ id, title, status, durationMs, reason, skipKind }) => ({ id, title, status, durationMs, reason, ...(skipKind ? { skipKind } : {}) })),
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(REPORT_MD, `${formatMarkdown(report)}\n`);

console.log(`\n${formatTable(report.results)}\n`);
const strictNote = verdict.strictSkips.length ? `; --strict: SKIP z braku narzedzi (${verdict.strictSkips.join(', ')})` : '';
console.log(`${verdict.ok ? 'WYNIK: PASS' : `WYNIK: FAIL (${verdict.failed.join(', ')}${strictNote})`}, ${formatDuration(report.durationMs)}. Raport: .claude/local-ci-last.json`);
for (const fn of cleanup) fn();
process.exit(verdict.exitCode);
