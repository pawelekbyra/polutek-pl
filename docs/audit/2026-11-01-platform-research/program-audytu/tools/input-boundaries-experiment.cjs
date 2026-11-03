/* Research only: actual body readers, native Request/FormData and actual Zod.
 * Authentication/context imports are explicit unused stubs; no HTTP/Next/Prisma.
 * Run from repository root with Node 22. Source hashes must match the baseline.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { z } = require('zod');
const base = 'docs/audit/2026-11-01-platform-research/program-audytu';
const inventory = new Map(fs.readFileSync(`${base}/INWENTARZ-PLIKOW.csv`, 'utf8').trim().split('\n').slice(1).map(line => { const c = line.split(','); return [c[0], c[4]]; }));
const actual = {};
const stubs = {
  './studio-session': {},
  '@/lib/modules/shared/app-context': {},
  '@admin/lib/actions/panel': {},
  '@admin/lib/auth/api-guard': {},
  '@admin/lib/config': {},
};
function load(file) {
  const bytes = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, inventory.get(file), `Source changed: ${file}`);
  actual[file] = digest;
  const mod = { exports: {} };
  const code = ts.transpileModule(bytes.toString(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file }).outputText;
  const localRequire = spec => {
    if (Object.hasOwn(stubs, spec)) return stubs[spec];
    if (spec === '@/lib/modules/shared/app-error') return load('lib/modules/shared/app-error.ts');
    throw new Error(`Unexpected import: ${spec}`);
  };
  new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file }).runInThisContext()(localRequire, mod, mod.exports);
  return mod.exports;
}
const limited = load('lib/utils/request-body.ts');
const studio = load('lib/api/studio-route.ts');
const panel = load('apps/admin/lib/api/panel-route.ts');
function request(bytes, type = 'application/json', contentLength) {
  bytes = Buffer.from(bytes);
  const stats = { total_bytes: bytes.length, supplied_bytes: 0 };
  const headers = new Headers({ 'content-type': type });
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  const stream = new ReadableStream({ pull(controller) {
    if (stats.supplied_bytes === bytes.length) return controller.close();
    const end = Math.min(stats.supplied_bytes + 256, bytes.length);
    controller.enqueue(bytes.subarray(stats.supplied_bytes, end));
    stats.supplied_bytes = end;
  } }, { highWaterMark: 0 });
  return { req: new Request('http://fixture.invalid/input', { method: 'POST', body: stream, duplex: 'half', headers }), stats };
}
const observations = [];
async function limitedCase(name, bytes, length, expected) {
  const { req, stats } = request(bytes, 'application/json', length);
  let outcome = 'OK';
  try { await limited.readRequestJsonWithLimit(req, 1024); } catch (error) { outcome = error.name; }
  assert.equal(outcome, expected);
  observations.push({ name, kind: 'ACTUAL_LIMITED_BODY_READER', outcome, ...stats });
}
async function main() {
  await limitedCase('bounded_valid_json', '{"title":"ok"}', undefined, 'OK');
  await limitedCase('declared_oversize_rejected_before_read', 'x'.repeat(2048), 2048, 'RequestBodyTooLargeError');
  await limitedCase('missing_length_stopped_at_chunk_over_limit', JSON.stringify({ title: 'x'.repeat(65536) }), undefined, 'RequestBodyTooLargeError');
  await limitedCase('understated_length_still_stopped', JSON.stringify({ title: 'x'.repeat(65536) }), 16, 'RequestBodyTooLargeError');
  await limitedCase('malformed_small_json_rejected', '{', undefined, 'MalformedJsonBodyError');
  assert.equal(observations[1].supplied_bytes, 0);
  for (const row of observations.slice(2, 4)) assert(row.supplied_bytes <= 1280 && row.supplied_bytes < row.total_bytes);
  const schema = z.object({ title: z.string().max(32) });
  for (const [name, reader] of [['studio', studio.readStudioJson], ['panel', panel.readJson]]) {
    for (const [suffix, title, valid] of [['valid', 'ok', true], ['oversize_field', 'x'.repeat(65536), false]]) {
      const { req, stats } = request(JSON.stringify({ title }));
      const result = await reader(req, schema);
      assert.equal(result.ok, valid);
      assert.equal(stats.supplied_bytes, stats.total_bytes);
      observations.push({ name: `${name}_${suffix}`, kind: 'ACTUAL_JSON_THEN_ZOD', accepted: result.ok, status: result.ok ? null : result.response.status, ...stats, finding: valid ? null : 'R15' });
    }
  }
  async function multipart(name, fileSize, paddingSize, declared) {
    const form = new FormData();
    if (fileSize !== null) form.set('file', new File([Buffer.alloc(fileSize, 65)], 'fixture.bin', { type: 'application/octet-stream' }));
    if (paddingSize) form.set('unused', 'x'.repeat(paddingSize));
    const encoded = new Request('http://fixture.invalid/encode', { method: 'POST', body: form });
    const bytes = Buffer.from(await encoded.arrayBuffer());
    const { req, stats } = request(bytes, encoded.headers.get('content-type'), declared ? bytes.length : undefined);
    const result = await panel.readUploadedFile(req, 'file', 1024);
    const row = { name, kind: 'ACTUAL_MULTIPART_READER', accepted: result.ok, status: result.ok ? null : result.response.status, returned_file_bytes: result.ok ? result.bytes.length : 0, ...stats };
    observations.push(row);
    return row;
  }
  let row = await multipart('small_file_accepted', 128, 0, false);
  assert(row.accepted && row.returned_file_bytes === 128);
  row = await multipart('small_file_large_unused_field_no_length', 128, 98304, false);
  assert(row.accepted && row.supplied_bytes === row.total_bytes && row.total_bytes > 98304);
  row.finding = 'R15';
  row = await multipart('declared_large_body_rejected_before_parse', 128, 98304, true);
  assert(!row.accepted && row.status === 413 && row.supplied_bytes === 0);
  row = await multipart('oversize_selected_file_rejected_after_parse', 2048, 0, false);
  assert(!row.accepted && row.status === 413 && row.supplied_bytes === row.total_bytes);
  row = await multipart('missing_file_rejected', null, 32, false);
  assert(!row.accepted && row.status === 400);
  console.log(JSON.stringify({ date: '2026-11-01', actual_source_sha256: actual, explicit_unused_import_stubs: Object.keys(stubs), observations,
    limits: ['Native in-process Request, not actual HTTP through a proxy or Next.', 'Authentication, CSRF, authorization and rate limiting not executed.', 'Synthetic fixtures <= 100 KiB; no memory or availability benchmark.', 'Understated Content-Length is a Web Request model, not proof that an HTTP server accepts inconsistent framing.', 'R15 concerns parse order and missing application-level total-body limit; deployment exploitability remains unverified.'] }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
