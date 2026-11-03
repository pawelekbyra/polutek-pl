const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const fromApp = createRequire('/app/package.json');
(async () => {
  assert.equal(process.getuid(), 1000, 'Runtime must use its unprivileged image user');
  assert.equal(existsSync('/run/secrets/proxy_ca'), false, 'Build CA mount leaked into runtime');
  assert.equal(process.env.NODE_EXTRA_CA_CERTS, undefined, 'Build CA setting leaked into runtime');
  const sharp = fromApp('sharp');
  const result = { node: process.version, uid: process.getuid(), next: fromApp('next/package.json').version,
    sharp: sharp.versions, checks: [], build_ca_present: false, network: 'none' };
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer();
  for (const format of ['png', 'jpeg', 'webp']) {
    const output = await sharp(png).resize(4, 4).toFormat(format).toBuffer();
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 4); assert.equal(metadata.height, 4); assert.equal(metadata.format, format);
    result.checks.push({ name: 'legal-' + format, status: 'PASS', bytes: output.length });
  }
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#123456"/></svg>');
  const rendered = await sharp(svg).png().toBuffer();
  assert.equal((await sharp(rendered).metadata()).format, 'png');
  result.checks.push({ name: 'benign-svg-librsvg-render', status: 'PASS', bytes: rendered.length });
  await assert.rejects(sharp(Buffer.from('this is not an image')).metadata());
  result.checks.push({ name: 'invalid-image-bytes-rejected', status: 'PASS' });
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (ffmpeg.status === 0) {
    const filters = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
    assert.equal(filters.status, 0);
    result.ffmpeg = { version: ffmpeg.stdout.split('\n')[0], zscale: /\bzscale\b/.test(filters.stdout), tonemap: /\btonemap\b/.test(filters.stdout) };
  }
  process.stdout.write(JSON.stringify(result) + '\n');
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
