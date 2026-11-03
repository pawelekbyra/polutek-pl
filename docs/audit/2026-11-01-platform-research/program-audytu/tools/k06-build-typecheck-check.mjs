import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const mode = process.argv[2];
assert.ok(['baseline', 'fixed'].includes(mode), 'Use baseline or fixed');
const output = process.env.POLUTEK_H1_EVIDENCE_DIR || '/workspace/.cloud-setup';
await fs.mkdir(output, { recursive: true });
const observations = [];
for (const [name, relativeConfig] of [['public', 'next.config.mjs'], ['admin', 'apps/admin/next.config.mjs']]) {
  for (const badType of (mode === 'baseline' ? [true] : [true, false])) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'polutek-k06-'));
    const label = `${mode}-${name}-${badType ? 'bad-type' : 'valid-type'}`;
    try {
      await fs.mkdir(path.join(dir, 'pages'));
      await fs.symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'polutek-k06-fixture', private: true }));
      await fs.writeFile(path.join(dir, 'pages/index.tsx'), `const value: number = ${badType ? "'deliberate-type-error'" : '123'};\nexport default function Page() { return <p>{value}</p>; }\n`);
      const configFile = path.join(root, relativeConfig);
      await fs.writeFile(path.join(dir, 'next.config.mjs'), `import config from ${JSON.stringify(pathToFileURL(configFile).href)};\nexport default { ...config, agentRules: false, experimental: { ...config.experimental, cpus: 1 } };\n`);
      let log = '';
      let timedOut = false;
      const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build', dir, '--webpack'], {
        cwd: dir, env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', b => { log += b.toString(); });
      child.stderr.on('data', b => { log += b.toString(); });
      let killTimer;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
      }, 120000);
      const result = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
      });
      clearTimeout(timeout);
      clearTimeout(killTimer);
      await fs.writeFile(path.join(output, `k06-${label}.log`), log);
      const expectedCode = mode === 'fixed' && badType ? 1 : 0;
      const expectedTypeError = /Type.*string.*not assignable.*number/i.test(log);
      const observation = { label, config: relativeConfig, configSha256: createHash('sha256').update(await fs.readFile(configFile)).digest('hex'), badType, code: result.code, expectedCode, signal: result.signal, timedOut, expectedTypeError };
      observations.push(observation);
      console.log(JSON.stringify(observation));
      assert.equal(timedOut, false, label);
      assert.equal(result.code, expectedCode, `${label}: ${log.slice(-1800)}`);
      if (mode === 'fixed' && badType) assert.equal(expectedTypeError, true, 'Failure must be the intended type error');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}
const report = { mode, next: require('next/package.json').version, result: 'PASS', observations,
  scope: 'Isolated actual Next builds importing each real app config; resource-only cpus=1 and agentRules=false overrides. Not full application builds, test gates or exact release artifact binding.' };
await fs.writeFile(path.join(output, `k06-build-typecheck-${mode}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ mode, result: 'PASS', builds: observations.length }));
