import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { HASH, hashJson, requireValue } from './source.mjs';
import { IMAGE_KINDS, expectedLabels, validateImageMetadata, validateInputs } from './policy.mjs';
import { inspectImage, verifyProof } from './proof.mjs';

const REPOSITORIES = Object.freeze({ app: 'polutek-app', migrator: 'polutek-migrator', worker: 'polutek-worker', collector: 'polutek-collector', admin: 'polutek-admin' });
const REGISTRY = /^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9._-]*$/;
const REVISION_TAG = /^[a-f0-9]{40}$/;

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    timeout: 15 * 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Verify every local image first, then publish only those immutable IDs and seal registry digests. */
export function publishRelease({ proof, proofSha256, revision, inputs, sourceRoot, registry, tag, output }, ports = {}) {
  requireValue(/^v22\./.test(process.version) && process.platform !== 'win32', 'Release publication requires Node 22 on POSIX');
  requireValue(REGISTRY.test(registry ?? ''), 'Invalid release registry/repository');
  requireValue(REVISION_TAG.test(tag ?? '') && tag === revision, 'Release tag must equal the full commit revision');
  requireValue(typeof output === 'string' && output.length > 0, 'Release proof output path is required');
  validateInputs(inputs);
  const inspect = ports.inspect ?? inspectImage;
  const runDocker = ports.docker ?? docker;
  const identities = verifyProof({ proof, proofSha256, revision, inputs, sourceRoot }, inspect);

  const registryRefs = {};
  for (const kind of IMAGE_KINDS) {
    const reference = `${registry}/${REPOSITORIES[kind]}:${tag}`;
    runDocker(['tag', identities[kind], reference]);
    const pushOutput = runDocker(['push', reference]);
    const digest = /\bdigest:\s*(sha256:[a-f0-9]{64})\b/.exec(pushOutput)?.[1];
    requireValue(HASH.test(digest?.slice('sha256:'.length) ?? ''), `Registry did not return an immutable digest for ${kind}`);
    const digestReference = `${registry}/${REPOSITORIES[kind]}@${digest}`;
    runDocker(['pull', digestReference]);
    const remote = inspect(digestReference);
    validateImageMetadata(remote, expectedLabels(proof.quality, inputs, revision, kind), identities[kind]);
    registryRefs[kind] = digestReference;
  }

  const publishedProof = { ...proof, images: Object.fromEntries(IMAGE_KINDS.map(kind => [kind,
    { ...proof.images[kind], registry_ref: registryRefs[kind] }])) };
  const publishedIdentities = verifyProof({ proof: publishedProof, proofSha256: hashJson(publishedProof),
    revision, inputs, sourceRoot }, inspect);
  requireValue(Object.keys(publishedIdentities).length === IMAGE_KINDS.length, 'Published image set is incomplete');
  writeFileSync(output, JSON.stringify(publishedProof, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { published: true, revision, proof_sha256: hashJson(publishedProof), path: output, images: publishedProof.images };
}
