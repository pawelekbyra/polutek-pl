import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { createProof } from '../../../scripts/ops/release/proof.mjs';
import { hashJson } from '../../../scripts/ops/release/source.mjs';
import { prepareReleaseArtifact } from '../../../scripts/ops/release-artifact.mjs';

const fixtures: ReturnType<typeof releaseControl>[] = [];
function fixture() { const f = releaseControl(); fixtures.push(f); return f; }
afterEach(() => { for (const f of fixtures.splice(0)) rmSync(f.directory, { recursive: true, force: true }); });

describe.skipIf(!/^v22\./.test(process.version) || process.platform === 'win32')('release artifact preparation', () => {
  it('checks artifact identity and source archive before producing deploy input', () => {
    const f = fixture();
    const artifact = path.join(f.directory, 'artifact');
    const output = path.join(f.directory, 'prepared');
    const inputsFile = path.join(artifact, 'inputs.json');
    const proofFile = path.join(artifact, 'published-release-proof.json');
    const resultFile = path.join(artifact, 'published-release-result.json');
    const proof = createProof({ report: f.report, inputs: f.inputs, revision: f.revision,
      references: f.references, sourceRoot: f.archive }, f.inspect);
    const published = { ...proof, images: Object.fromEntries(Object.entries(proof.images).map(([kind, image]) => [kind,
      { ...image, registry_ref: `ghcr.io/pawelekbyra/polutek-${kind}@sha256:${'e'.repeat(64)}` }])) };
    mkdirSync(artifact);
    execFileSync('git', ['-C', f.repo, 'archive', '--format=tar', '-o', path.join(artifact, 'source.tar'), 'HEAD']);
    writeFileSync(path.join(artifact, 'quality.json'), JSON.stringify(f.report));
    writeFileSync(inputsFile, JSON.stringify(f.inputs));
    writeFileSync(proofFile, JSON.stringify(published));
    writeFileSync(resultFile, JSON.stringify({ published: true, revision: f.revision, proof_sha256: hashJson(published) }));

    const result = prepareReleaseArtifact({ artifact, revision: f.revision, output });
    expect(result.prepared).toBe(true);
    expect(result.proof_sha256).toBe(hashJson(published));
    expect(readFileSync(path.join(output, 'proof.json'), 'utf8')).toBe(JSON.stringify(published));
    expect(readFileSync(path.join(output, 'source/app.txt'), 'utf8')).toContain('control source');

    writeFileSync(resultFile, JSON.stringify({ published: true, revision: f.revision, proof_sha256: '0'.repeat(64) }));
    expect(() => prepareReleaseArtifact({ artifact, revision: f.revision, output: path.join(f.directory, 'rejected') }))
      .toThrow('proof hash does not match');
  });
});
