import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { releaseControl } from '../../fixtures/release-control.mjs';
import { createProof } from '../../../scripts/ops/release/proof.mjs';
import { hashJson } from '../../../scripts/ops/release/source.mjs';

const root = path.resolve(__dirname, '../../..');
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const fixture = releaseControl();
  dirs.push(fixture.directory);
  const repo = fixture.repo;
  const ops = path.join(repo, 'scripts/ops');
  mkdirSync(ops, { recursive: true });
  copyFileSync(path.join(root, 'scripts/ops/mergedeploy.sh'), path.join(ops, 'mergedeploy.sh'));
  copyFileSync(path.join(root, 'scripts/ops/release-artifact.mjs'), path.join(ops, 'release-artifact.mjs'));
  const releaseOps = path.join(ops, 'release');
  mkdirSync(releaseOps);
  for (const file of ['source.mjs', 'proof.mjs', 'policy.mjs', 'images.mjs', 'build.mjs', 'publish.mjs']) {
    const source = path.join(root, 'scripts/ops/release', file);
    if (existsSync(source)) copyFileSync(source, path.join(releaseOps, file));
  }
  execFileSync('git', ['-C', repo, 'branch', '-M', 'main']);
  execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', repo]);

  const artifact = path.join(fixture.directory, 'artifact');
  mkdirSync(artifact);
  execFileSync('git', ['-C', repo, 'archive', '--format=tar', '-o', path.join(artifact, 'source.tar'), 'HEAD']);
  writeFileSync(path.join(artifact, 'quality.json'), JSON.stringify(fixture.report));
  writeFileSync(path.join(artifact, 'inputs.json'), JSON.stringify(fixture.inputs));
  const proof = createProof({ report: fixture.report, inputs: fixture.inputs, revision: fixture.revision,
    references: fixture.references, sourceRoot: fixture.archive }, fixture.inspect);
  const published = { ...proof, images: Object.fromEntries(Object.entries(proof.images).map(([kind, image]) => [kind,
    { ...image, registry_ref: `ghcr.io/pawelekbyra/polutek-${kind}@sha256:${'e'.repeat(64)}` }])) };
  writeFileSync(path.join(artifact, 'published-release-proof.json'), JSON.stringify(published));
  writeFileSync(path.join(artifact, 'published-release-result.json'), JSON.stringify({
    published: true, revision: fixture.revision, proof_sha256: hashJson(published),
  }));

  const bin = path.join(fixture.directory, 'bin');
  mkdirSync(bin);
  const ghLog = path.join(fixture.directory, 'gh.log');
  const fakeGh = path.join(bin, 'gh');
  writeFileSync(fakeGh, `#!/bin/sh
printf '%s\\n' "$*" >> '${posix(ghLog)}'
case "$1 $2" in
  'pr view') echo MERGED ;;
  'run view') printf '{"headSha":"%s","status":"completed","conclusion":"success","workflowName":"images"}\\n' "\${FAKE_RUN_SHA:-${fixture.revision}}" ;;
  'run download')
    shift 2
    while [ "$#" -gt 0 ]; do
      case "$1" in --dir) target="$2"; shift 2;; *) shift;; esac
    done
    cp -a "$FAKE_RELEASE_ARTIFACT/." "$target/"
    ;;
  *) exit 98 ;;
esac
`);
  chmodSync(fakeGh, 0o755);
  const sshLog = path.join(fixture.directory, 'ssh.log');
  const tarFile = path.join(fixture.directory, 'staged.tar');
  const fakeSsh = path.join(bin, 'ssh');
  writeFileSync(fakeSsh, `#!/bin/sh\nprintf '%s\\n' "$*" > '${sshLog}'\ncat > '${tarFile}'\n`);
  chmodSync(fakeSsh, 0o755);

  return { fixture, repo, artifact, bin, ghLog, sshLog, tarFile, publishedHash: hashJson(published) };
}

const posix = (value: string) => value.replace(/\\/g, '/');
const enabled = /^v22\./.test(process.version) && process.platform !== 'win32';

describe.skipIf(!enabled)('mergedeploy release transfer (local fixtures only)', () => {
  it('stages a valid bundle and proof-bound source to a mocked SSH transport', () => {
    const f = setup();
    const result = spawnSync('bash', ['scripts/ops/mergedeploy.sh', '123', 'branch', 'release'], {
      cwd: f.repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${f.bin}${path.delimiter}${process.env.PATH ?? ''}`,
        RELEASE_BUNDLE_DIR: f.artifact, RELEASE_REVISION: f.fixture.revision, RELEASE_PROOF_SHA256: f.publishedHash },
      timeout: 30_000,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(f.sshLog, 'utf8')).toContain('DEPLOY_LOCK_HELD=1');
    expect(execFileSync('tar', ['-tf', f.tarFile], { encoding: 'utf8' })).toContain(
      `.release-artifacts/${f.fixture.revision}/source/app.txt`,
    );
  });

  it('rejects a mismatched externally approved proof hash before SSH', () => {
    const f = setup();
    const result = spawnSync('bash', ['scripts/ops/mergedeploy.sh', '123', 'branch', 'release'], {
      cwd: f.repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${f.bin}${path.delimiter}${process.env.PATH ?? ''}`,
        RELEASE_BUNDLE_DIR: f.artifact, RELEASE_REVISION: f.fixture.revision, RELEASE_PROOF_SHA256: '0'.repeat(64) },
      timeout: 30_000,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(4);
    expect(result.stderr).toContain('proof does not match the externally approved hash');
    expect(existsSync(f.sshLog)).toBe(false);
    expect(existsSync(f.tarFile)).toBe(false);
  });

  it('rejects a release revision that is not the fetched main SHA before SSH', () => {
    const f = setup();
    const result = spawnSync('bash', ['scripts/ops/mergedeploy.sh', '123', 'branch', 'release'], {
      cwd: f.repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${f.bin}${path.delimiter}${process.env.PATH ?? ''}`,
        RELEASE_BUNDLE_DIR: f.artifact, RELEASE_REVISION: 'f'.repeat(40), RELEASE_PROOF_SHA256: f.publishedHash },
      timeout: 30_000,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(4);
    expect(result.stderr).toContain('RELEASE_REVISION nie odpowiada origin/main');
    expect(existsSync(f.sshLog)).toBe(false);
  });

  it('rejects a missing local artifact before SSH', () => {
    const f = setup();
    const result = spawnSync('bash', ['scripts/ops/mergedeploy.sh', '123', 'branch', 'release'], {
      cwd: f.repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${f.bin}${path.delimiter}${process.env.PATH ?? ''}`,
        RELEASE_BUNDLE_DIR: path.join(f.fixture.directory, 'missing-artifact'),
        RELEASE_REVISION: f.fixture.revision, RELEASE_PROOF_SHA256: f.publishedHash },
      timeout: 30_000,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(4);
    expect(result.stderr).toContain('lokalny artifact nie istnieje');
    expect(existsSync(f.sshLog)).toBe(false);
  });

  it('rejects a run whose head SHA differs from the requested release before download or SSH', () => {
    const f = setup();
    const result = spawnSync('bash', ['scripts/ops/mergedeploy.sh', '123', 'branch', 'release'], {
      cwd: f.repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${f.bin}${path.delimiter}${process.env.PATH ?? ''}`,
        RELEASE_RUN_ID: '456', RELEASE_REVISION: f.fixture.revision, RELEASE_PROOF_SHA256: f.publishedHash,
        FAKE_RELEASE_ARTIFACT: f.artifact, FAKE_RUN_SHA: 'f'.repeat(40) },
      timeout: 30_000,
    });

    expect(result.status, `${result.stdout}\\n${result.stderr}`).toBe(4);
    expect(result.stderr).toContain('images workflow nie ma zielonego wyniku');
    expect(readFileSync(f.ghLog, 'utf8')).not.toContain('run download');
    expect(existsSync(f.sshLog)).toBe(false);
  });

  it('downloads and stages a valid completed images artifact through the GH CLI path', () => {
    const f = setup();
    const result = spawnSync('bash', ['scripts/ops/mergedeploy.sh', '123', 'branch', 'release'], {
      cwd: f.repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${f.bin}${path.delimiter}${process.env.PATH ?? ''}`,
        RELEASE_RUN_ID: '456', RELEASE_REVISION: f.fixture.revision, RELEASE_PROOF_SHA256: f.publishedHash,
        FAKE_RELEASE_ARTIFACT: f.artifact },
      timeout: 30_000,
    });

    expect(result.status, `${result.stdout}\\n${result.stderr}`).toBe(0);
    expect(readFileSync(f.ghLog, 'utf8')).toContain('run download 456');
    expect(readFileSync(f.sshLog, 'utf8')).toContain('DEPLOY_LOCK_HELD=1');
    expect(execFileSync('tar', ['-tf', f.tarFile], { encoding: 'utf8' })).toContain(
      `.release-artifacts/${f.fixture.revision}/source/app.txt`,
    );
  });
});
