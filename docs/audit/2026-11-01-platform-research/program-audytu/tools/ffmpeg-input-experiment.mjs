/* Research: actual unchanged run/probeSource and upload policy; bounded local
 * fixture server, no production or other network targets. Run from repo root.
 * Host ffmpeg is not the declared production Docker binary.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const base = 'docs/audit/2026-11-01-platform-research/program-audytu';
const inventory = new Map((await readFile(`${base}/INWENTARZ-PLIKOW.csv`, 'utf8')).trim().split('\n').slice(1).map(line => { const c = line.split(','); return [c[0], c[4]]; }));
const actual = {};
for (const file of ['scripts/hls/encode-hls.mjs', 'lib/modules/video-pipeline/domain/upload-policy.ts']) {
  const bytes = await readFile(file);
  actual[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual[file], inventory.get(file), `Source changed: ${file}`);
}
const { run, probeSource } = await import(path.resolve('scripts/hls/encode-hls.mjs'));
const module = { exports: {} };
const policyCode = ts.transpileModule(await readFile('lib/modules/video-pipeline/domain/upload-policy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new vm.Script(`(function(module,exports){${policyCode}\n})`).runInThisContext()(module, module.exports);
const policy = module.exports;
const observations = [];
const directory = await mkdtemp(path.join(os.tmpdir(), 'polutek-input-audit-'));
let server;
try {
  const version = (await run('ffmpeg', ['-version'], { timeoutMs: 3000 })).stdout.split('\n')[0];
  const probeVersion = (await run('ffprobe', ['-version'], { timeoutMs: 3000 })).stdout.split('\n')[0];
  const clip = path.join(directory, 'fixture.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1:d=1', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', clip], { timeoutMs: 10000 });
  const info = await probeSource(clip, { timeoutMs: 3000 });
  assert.equal(info.width, 64); assert.equal(info.height, 64);
  observations.push({ name: 'valid_video_control', accepted: true, width: info.width, height: info.height });
  const audio = path.join(directory, 'audio.wav');
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.1', audio], { timeoutMs: 5000 });
  await assert.rejects(() => probeSource(audio, { timeoutMs: 3000 }), /Source has no video stream/);
  observations.push({ name: 'audio_only_rejected', accepted: false, reason: 'Source has no video stream' });
  const marker = path.join(directory, 'PWNED');
  const literalName = path.join(directory, 'clip; touch PWNED; .mp4');
  await copyFile(clip, literalName);
  assert.equal((await probeSource(literalName, { timeoutMs: 3000 })).width, 64);
  let markerPresent = true;
  try { await access(marker); } catch { markerPresent = false; }
  let cwdMarkerPresent = true;
  try { await access('PWNED'); } catch { cwdMarkerPresent = false; }
  assert(!markerPresent && !cwdMarkerPresent);
  observations.push({ name: 'shell_metacharacters_treated_as_literal_filename', accepted: true, marker_created: false });
  const bytes = await readFile(clip);
  const hits = [];
  server = createServer((req, res) => { hits.push({ path: req.url, method: req.method }); res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }); res.end(bytes); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  // Positive controls: this exact endpoint is reachable by Node and ffprobe.
  const response = await fetch(`http://127.0.0.1:${port}/fixture.mp4`);
  assert.equal((await response.arrayBuffer()).byteLength, bytes.length);
  assert.equal(hits.length, 1);
  const probeHitsBefore = hits.length;
  const remoteInfo = await probeSource(`http://127.0.0.1:${port}/fixture.mp4`, { timeoutMs: 3000 });
  assert.equal(remoteInfo.width, 64);
  assert(hits.length > probeHitsBefore);
  observations.push({ name: 'loopback_fixture_server_control', node_requests: 1, ffprobe_requests: hits.length - probeHitsBefore, status: response.status, ffprobe_width: remoteInfo.width });
  for (const atom of ['ftyp', 'free', 'skip', 'pnot']) {
    const xml = `<!--${atom}-->\n<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT1S" minBufferTime="PT1S"><Period duration="PT1S"><AdaptationSet mimeType="video/mp4" contentType="video"><Representation id="r" bandwidth="10000" width="64" height="64" codecs="avc1.42C00A"><SegmentList timescale="1" duration="1"><SegmentURL media="http://127.0.0.1:${port}/fixture.mp4"/></SegmentList></Representation></AdaptationSet></Period></MPD>`;
    const payload = Buffer.from(xml + ' '.repeat(65536 - Buffer.byteLength(xml)));
    const file = path.join(directory, `${atom}.mp4`);
    await writeFile(file, payload);
    const metadata = policy.validateUploadRequest({ fileName: `${atom}.mp4`, fileSize: payload.length, contentType: 'video/mp4' }, 1024 * 1024);
    const sniff = policy.sniffVideoContainer(payload.subarray(0, policy.SNIFF_BYTES));
    assert(metadata.ok && sniff === 'mp4');
    const before = hits.length;
    let rejected = false, moovMissing = false;
    try { await probeSource(file, { timeoutMs: 2000 }); } catch (error) { rejected = true; moovMissing = /moov atom not found/.test(error.message); }
    assert(rejected && moovMissing && hits.length === before);
    observations.push({ name: `xml_mp4_atom_${atom}`, pure_metadata_accepted: metadata.ok, sniff, probe_rejected: rejected, moov_missing: moovMissing, loopback_requests: hits.length - before });
  }
  for (const [name, code, options, errorName] of [
    ['process_timeout', 'setInterval(()=>{},1000)', { timeoutMs: 150 }, 'TimeoutError'],
    ['stdout_limit', 'process.stdout.write("x".repeat(100000));setInterval(()=>{},1000)', { timeoutMs: 2000, maxStdoutBytes: 1024 }, 'OutputLimitError'],
  ]) {
    await assert.rejects(() => run(process.execPath, ['-e', code], options), { name: errorName });
    observations.push({ name, error_name: errorName });
  }
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 150);
  try { await assert.rejects(() => run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal, timeoutMs: 2000 }), { name: 'AbortError' }); } finally { clearTimeout(abortTimer); }
  observations.push({ name: 'running_process_abort', error_name: 'AbortError' });
  console.log(JSON.stringify({ date: '2026-11-01', actual_source_sha256: actual, host_ffmpeg: version, host_ffprobe: probeVersion, declared_worker_image: 'mwader/static-ffmpeg:8.0.1', observations,
    limits: ['Actual host FFmpeg 7.1.5 differs from declared Docker FFmpeg 8.0.1; production not inspected.', 'Four synthetic XML/MP4 candidates only; no exhaustive malformed-media corpus or SSRF absence proof.', 'Metadata/sniff are pure functions; HTTP/R2/complete-upload path not executed.', 'Only own ephemeral loopback fixture was targeted; no external or production network.', 'Process limits tested with bounded benign Node children, not a demonstrated FFmpeg hang.', 'No full encode, image RCE exploit, quality or capacity benchmark.'] }, null, 2));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(directory, { recursive: true, force: true });
}
