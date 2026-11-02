import { execFileSync } from 'node:child_process';
import { HASH, IMAGE_ID, canonical, hashJson, requireValue, verifySourceArchive } from './source.mjs';
import { IMAGE_KINDS, expectedLabels, validateImageMetadata, validateInputs, validateQuality } from './policy.mjs';

/** The caller controls Docker endpoint selection. Never dump image env or registry credentials. */
export function inspectImage(reference) {
  requireValue(typeof reference === 'string' && /^[a-z0-9][a-z0-9./:@_-]{1,255}$/.test(reference), 'Invalid image reference');
  const output = execFileSync('docker', ['image', 'inspect', '--format',
    '{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"RootFS":{"Layers":{{json .RootFS.Layers}}},"Config":{"Labels":{{json .Config.Labels}}}}', reference],
  { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] });
  try { return JSON.parse(output); } catch { throw new Error('Invalid Docker inspection result'); }
}

function validateImageSet(images) {
  requireValue(images && canonical(Object.keys(images).sort()) === canonical([...IMAGE_KINDS].sort()), 'All five release images are required');
}

function verifyBase(metadata, kind, inputs, inspect) {
  const base = inspect(kind === 'collector' ? inputs.bases.collector : inputs.bases.node);
  requireValue(`${metadata.Os}/${metadata.Architecture}` === inputs.platform, 'Image platform mismatch');
  const layers = base.RootFS?.Layers;
  requireValue(Array.isArray(layers) && layers.length > 0 && layers.every(layer => IMAGE_ID.test(layer)), 'Invalid base image layers');
  requireValue(Array.isArray(metadata.RootFS?.Layers)
    && canonical(metadata.RootFS.Layers.slice(0, layers.length)) === canonical(layers), 'Image base ancestry mismatch');
}

export function createProof({ report, inputs, references, sourceRoot, revision }, inspect = inspectImage) {
  requireValue(process.platform !== 'win32', 'Sealing requires POSIX archive mode verification (use Linux/WSL)');
  const quality = validateQuality(report, revision);
  validateInputs(inputs);
  verifySourceArchive(sourceRoot, quality.source);
  validateImageSet(references);
  /** @type {Record<string, { id: string, registry_ref?: string }>} */
  const images = {};
  for (const kind of IMAGE_KINDS) {
    const labels = expectedLabels(report, inputs, revision, kind);
    const metadata = inspect(references[kind]);
    images[kind] = { id: validateImageMetadata(metadata, labels) };
    verifyBase(metadata, kind, inputs, inspect);
  }
  // Recheck source after Docker inspection too; never seal an archive changed during the operation.
  verifySourceArchive(sourceRoot, quality.source);
  return { schema_version: 1, revision, source_fingerprint: quality.source.fingerprint,
    quality_sha256: quality.qualitySha256, inputs_sha256: hashJson(inputs), quality: report, inputs, images };
}

function validateProof(proof, revision, inputs) {
  requireValue(proof && proof.schema_version === 1 && proof.revision === revision, 'Release proof revision/schema mismatch');
  const quality = validateQuality(proof.quality, revision);
  const inputHash = validateInputs(proof.inputs);
  requireValue(validateInputs(inputs) === inputHash, 'Current build inputs differ from the tested release');
  requireValue(proof.source_fingerprint === quality.source.fingerprint && proof.quality_sha256 === quality.qualitySha256
    && proof.inputs_sha256 === inputHash, 'Release evidence identity mismatch');
  validateImageSet(proof.images);
  for (const kind of IMAGE_KINDS) {
    const image = proof.images[kind];
    requireValue(image && IMAGE_ID.test(image.id), `Invalid image identity: ${kind}`);
    if (image.registry_ref !== undefined) requireValue(typeof image.registry_ref === 'string'
      && /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(image.registry_ref), 'Registry references must be pinned by digest');
  }
  return quality;
}

export function verifyProof({ proof, proofSha256, revision, inputs, sourceRoot, scope = 'all' }, inspect = inspectImage) {
  requireValue(process.platform !== 'win32', 'Release verification requires POSIX archive modes (use Linux/WSL)');
  requireValue(['all', 'app', 'admin'].includes(scope), 'Unknown release verification scope');
  // The expected hash must come from the producer/reviewer, not from the file being verified.
  requireValue(HASH.test(proofSha256 ?? '') && hashJson(proof) === proofSha256, 'Approved release proof hash mismatch');
  const quality = validateProof(proof, revision, inputs);
  verifySourceArchive(sourceRoot, quality.source);
  const selected = scope === 'admin' ? ['admin'] : scope === 'app' ? IMAGE_KINDS.filter(kind => kind !== 'admin') : IMAGE_KINDS;
  /** @type {Record<string, string>} */
  const identities = {};
  for (const kind of selected) {
    const image = proof.images[kind];
    const metadata = inspect(image.registry_ref ?? image.id);
    identities[kind] = validateImageMetadata(metadata, expectedLabels(proof.quality, inputs, revision, kind), image.id);
    verifyBase(metadata, kind, inputs, inspect);
  }
  verifySourceArchive(sourceRoot, quality.source);
  return identities;
}
