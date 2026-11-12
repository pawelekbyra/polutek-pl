import { HASH, REVISION, canonical, hashJson, requireValue, validateSnapshot } from './source.mjs';

export const REQUIRED_GATES = Object.freeze([
  'prisma', 'ci-parity', 'migrations', 'unit', 'critical-path', 'typecheck', 'typecheck-all',
  'lint', 'architecture', 'hotspots', 'strict-escapes', 'env', 'audit', 'postgres',
  'encode-smoke', 'build', 'admin-build',
]);

export const IMAGE_KINDS = Object.freeze(['app', 'migrator', 'worker', 'collector', 'admin']);
export const PUBLIC_ARGS = Object.freeze([
  'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_R2_PUBLIC_HOST', 'NEXT_PUBLIC_BLOB_PUBLIC_HOST', 'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_SUPPORT_EMAIL', 'NEXT_PUBLIC_SITE_BETA',
]);

export function testSummaryPasses(summary, { noSkips = false } = {}) {
  return summary && summary.success === true && Number.isInteger(summary.total) && summary.total > 0
    && Number.isInteger(summary.passed) && summary.passed > 0
    && Number.isInteger(summary.files) && summary.files > 0 && summary.files <= summary.total
    && summary.failed === 0 && Number.isInteger(summary.skipped) && summary.skipped >= 0
    && summary.total === summary.passed + summary.skipped
    && Array.isArray(summary.failedFiles) && summary.failedFiles.length === 0
    && (!noSkips || summary.skipped === 0);
}

export function validateQuality(report, expectedRevision) {
  requireValue(REVISION.test(expectedRevision), 'Expected revision must be a full commit SHA');
  requireValue(report && report.ok === true && report.head === expectedRevision, 'Quality result/revision mismatch');
  requireValue(typeof report.node === 'string' && /^v22\./.test(report.node), 'Release checks require the supported Node 22 runtime');
  requireValue(Array.isArray(report.failed) && report.failed.length === 0
    && Array.isArray(report.strictSkips) && report.strictSkips.length === 0, 'Quality report contains failures or strict skips');
  requireValue(report.dirty === false && report.dirtyAfter === false && report.sourceStable === true, 'Quality source was dirty or changed during checks');
  const options = report.options;
  requireValue(options && options.lintAll === true && options.unitFull === true && options.build === true && options.strict === true
    && Array.isArray(options.only) && options.only.length === 0 && Array.isArray(options.skip) && options.skip.length === 0
    && !options.list && !options.help, 'Release requires full strict checks without filters or skips');
  const before = validateSnapshot(report.sourceBefore);
  const after = validateSnapshot(report.sourceAfter);
  requireValue(before.revision === expectedRevision && after.revision === expectedRevision && before.fingerprint === after.fingerprint, 'Quality source snapshots differ');
  requireValue(Array.isArray(report.results) && report.results.length === REQUIRED_GATES.length, 'Missing or unexpected quality gates');
  const results = new Map();
  for (const gate of report.results) {
    requireValue(gate && REQUIRED_GATES.includes(gate.id) && !results.has(gate.id), 'Unknown or duplicate quality gate');
    requireValue(gate.status === 'PASS' && Number.isFinite(gate.durationMs) && gate.durationMs >= 0, `Required gate did not pass: ${gate.id}`);
    results.set(gate.id, gate);
  }
  for (const id of ['unit', 'critical-path', 'postgres', 'encode-smoke']) {
    const summary = results.get(id)?.testSummary;
    requireValue(testSummaryPasses(summary, { noSkips: id !== 'unit' }), `Missing, empty or unsuccessful test report: ${id}`);
    if (id === 'critical-path') requireValue(summary.files === 2, 'Both critical-path suites are required');
    if (id === 'encode-smoke') requireValue(summary.total === 3, 'All three encoder smoke cases are required');
  }
  return { revision: expectedRevision, source: before, qualitySha256: hashJson(report) };
}

function exactKeys(value, keys, message) {
  requireValue(value && !Array.isArray(value) && typeof value === 'object'
    && canonical(Object.keys(value).sort()) === canonical([...keys].sort()), message);
}

export function validateInputs(inputs) {
  exactKeys(inputs, ['schema_version', 'platform', 'bases', 'public_args'], 'Unexpected build input fields');
  requireValue(inputs.schema_version === 1 && ['linux/amd64', 'linux/arm64'].includes(inputs.platform), 'Invalid build platform/schema');
  exactKeys(inputs.bases, ['node', 'ffmpeg', 'collector'], 'All pinned base image references are required');
  for (const value of Object.values(inputs.bases)) {
    requireValue(typeof value === 'string' && /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(value), 'Base images must use immutable registry digests');
  }
  exactKeys(inputs.public_args, PUBLIC_ARGS, 'Only the complete public build argument set is accepted');
  for (const value of Object.values(inputs.public_args)) {
    requireValue(typeof value === 'string' && value.length <= 2048 && !/[\x00-\x1f]/.test(value), 'Invalid public build argument');
  }
  return hashJson(inputs);
}

export function expectedLabels(report, inputs, expectedRevision, kind) {
  requireValue(IMAGE_KINDS.includes(kind), 'Unknown release image kind');
  const quality = validateQuality(report, expectedRevision);
  return {
    'org.opencontainers.image.revision': expectedRevision,
    'org.polutek.release.source': quality.source.fingerprint,
    'org.polutek.release.quality': quality.qualitySha256,
    'org.polutek.release.inputs': validateInputs(inputs),
    'org.polutek.release.kind': kind,
  };
}

export function validateImageMetadata(metadata, labels, expectedId) {
  requireValue(metadata && typeof metadata.Id === 'string' && /^sha256:[a-f0-9]{64}$/.test(metadata.Id), 'Invalid Docker image identity');
  if (expectedId) requireValue(metadata.Id === expectedId, 'Docker image identity changed');
  for (const [key, value] of Object.entries(labels)) requireValue(metadata.Config?.Labels?.[key] === value, `Image proof label mismatch: ${key}`);
  requireValue(HASH.test(labels['org.polutek.release.inputs']), 'Invalid input identity');
  return metadata.Id;
}
