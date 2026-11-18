import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { createProof } from '../../../scripts/ops/release/proof.mjs';
import { hashJson, sha256 } from '../../../scripts/ops/release/source.mjs';
import { publishRelease } from '../../../scripts/ops/release/publish.mjs';

const fixtures: ReturnType<typeof releaseControl>[] = [];
function fixture() { const f = releaseControl(); fixtures.push(f); return f; }
afterEach(() => { for (const f of fixtures.splice(0)) rmSync(f.directory, { recursive: true, force: true }); });

function publishPorts(f: ReturnType<typeof releaseControl>, mode = 'valid') {
  const calls: string[][] = [];
  const remote = new Map<string, unknown>();
  const inspect = (reference: string) => remote.get(reference) ?? f.inspect(reference);
  const docker = (args: string[]) => {
    calls.push(args);
    if (args[0] === 'push') {
      if (mode === 'bad-digest') return 'pushed without immutable digest';
      const tagged = args[1];
      const localId = calls.find(c => c[0] === 'tag' && c[2] === tagged)?.[1];
      const imageKind = Object.keys(f.metadata).find(key => f.metadata[key as keyof typeof f.metadata].Id === localId);
      if (!imageKind || !localId) throw new Error('Unexpected test image');
      const digest = `sha256:${sha256(localId)}`;
      remote.set(`${tagged.slice(0, tagged.lastIndexOf(':'))}@${digest}`, f.metadata[imageKind as keyof typeof f.metadata]);
      return `digest: ${digest}\n`;
    }
    return '';
  };
  return { calls, inspect, docker };
}

describe('release image publication', () => {
  it('verifies every local image before pushing and seals every remote digest', () => {
    const f = fixture(); const proof = createProof({ report: f.report, inputs: f.inputs, revision: f.revision,
      references: f.references, sourceRoot: f.archive }, f.inspect);
    const ports = publishPorts(f); const output = path.join(f.directory, 'published-proof.json');
    const result = publishRelease({ proof, proofSha256: hashJson(proof), revision: f.revision, inputs: f.inputs,
      sourceRoot: f.archive, registry: 'ghcr.io/example', tag: f.revision, output }, ports);
    expect(result.published).toBe(true);
    expect(ports.calls.filter(call => call[0] === 'push')).toHaveLength(5);
    expect(ports.calls.filter(call => call[0] === 'tag').map(call => call[1])).toEqual(Object.values(proof.images).map(image => image.id));
    const published = JSON.parse(readFileSync(output, 'utf8'));
    expect(Object.values(published.images).every((image: any) => /^ghcr\.io\/example\/polutek-[a-z]+@sha256:[a-f0-9]{64}$/.test(image.registry_ref))).toBe(true);
    expect(result.proof_sha256).toBe(hashJson(published));
  });

  it('rejects a modified proof before any registry side effect', () => {
    const f = fixture(); const proof = createProof({ report: f.report, inputs: f.inputs, revision: f.revision,
      references: f.references, sourceRoot: f.archive }, f.inspect);
    const ports = publishPorts(f); const output = path.join(f.directory, 'should-not-exist.json');
    expect(() => publishRelease({ proof, proofSha256: '0'.repeat(64), revision: f.revision, inputs: f.inputs,
      sourceRoot: f.archive, registry: 'ghcr.io/example', tag: f.revision, output }, ports)).toThrow('hash mismatch');
    expect(ports.calls).toEqual([]);
  });

  it('rejects mutable tags and missing registry digests', () => {
    const f = fixture(); const proof = createProof({ report: f.report, inputs: f.inputs, revision: f.revision,
      references: f.references, sourceRoot: f.archive }, f.inspect);
    const ports = publishPorts(f, 'bad-digest'); const output = path.join(f.directory, 'should-not-exist.json');
    const args = { proof, proofSha256: hashJson(proof), revision: f.revision, inputs: f.inputs, sourceRoot: f.archive,
      registry: 'ghcr.io/example', tag: 'latest', output };
    expect(() => publishRelease(args, ports)).toThrow('full commit revision');
    expect(ports.calls).toEqual([]);
    expect(() => publishRelease({ ...args, tag: f.revision }, ports)).toThrow('immutable digest');
    expect(ports.calls.some(call => call[0] === 'push')).toBe(true);
    expect(() => readFileSync(output)).toThrow();
  });
});
