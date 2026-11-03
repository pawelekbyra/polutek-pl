import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const sharp = require('sharp');
const observations = [];
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'polutek-k02-'));
let child;
let log = '';
try {
  const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#204080' } }).png().toBuffer();
  const webp = await sharp(png).resize(16, 12).webp().toBuffer();
  const meta = await sharp(webp).metadata();
  assert.equal(sharp.versions.sharp, '0.35.5');
  assert.equal(sharp.versions.rsvg, '2.63.2');
  assert.equal(meta.width, 16);
  assert.equal(meta.height, 12);
  await assert.rejects(() => sharp(Buffer.from('not an image')).metadata());
  observations.push({ test: 'native-runtime', sharp: sharp.versions.sharp, librsvg: sharp.versions.rsvg, vips: sharp.versions.vips, invalidImageRejected: true, width: meta.width, height: meta.height });
  await fs.mkdir(path.join(directory, 'pages'));
  await fs.mkdir(path.join(directory, 'public'));
  await fs.symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'));
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'polutek-k02-fixture', private: true }));
  await fs.writeFile(path.join(directory, 'pages/index.js'), 'export default function Page() { return "Image runtime fixture"; }\n');
  await fs.writeFile(path.join(directory, 'next.config.mjs'), `import config from ${JSON.stringify(pathToFileURL(path.join(root, 'next.config.mjs')).href)};\nexport default config;\n`);
  await fs.writeFile(path.join(directory, 'public/sample.png'), png);
  await fs.writeFile(path.join(directory, 'public/sample.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>');
  await fs.writeFile(path.join(directory, 'public/invalid.png'), 'not an image');
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', directory, '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: directory, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', b => { log += b.toString(); });
  child.stderr.on('data', b => { log += b.toString(); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 160; i++) {
    if (child.exitCode !== null) throw new Error(`Next exited ${child.exitCode}`);
    try { const r = await fetch(`${base}/sample.png`, { signal: AbortSignal.timeout(1500) }); if (r.status === 200) { ready = true; break; } } catch {}
    await pause(250);
  }
  assert.ok(ready, 'Next image fixture must start');
  for (const [name, url, expected] of [
    ['legal-png', '/sample.png', 200],
    ['svg-denied', '/sample.svg', 400],
    ['invalid-image-denied', '/invalid.png', 400],
    ['foreign-host-denied', 'https://unapproved.invalid/picture.png', 400],
  ]) {
    const r = await fetch(`${base}/_next/image?url=${encodeURIComponent(url)}&w=32&q=75`, { headers: { accept: 'image/webp' }, signal: AbortSignal.timeout(30000) });
    const body = Buffer.from(await r.arrayBuffer());
    assert.equal(r.status, expected, `${name}: ${r.status === expected ? '' : body.toString('utf8')}`);
    if (name === 'legal-png') {
      const image = await sharp(body).metadata();
      assert.equal(image.width, 32);
      assert.equal(image.height, 24);
      assert.match(r.headers.get('content-type') ?? '', /^image\//);
    }
    observations.push({ test: name, status: r.status, expected, contentType: r.headers.get('content-type') });
  }
  const result = { next: require('next/package.json').version, result: 'PASS', observations, scope: 'Isolated Next fixture using the real public Next config and installed native libraries; not the full application, production build or deployed image.' };
  await fs.writeFile('/workspace/.cloud-setup/k02-image-runtime-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await Promise.race([exited, pause(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await fs.writeFile('/workspace/.cloud-setup/k02-next-runtime.log', log);
  await fs.rm(directory, { recursive: true, force: true });
}
