// Synthetic control receipts for validator tests, never evidence of real application checks.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureGitSource, sha256 } from '../../scripts/ops/release/source.mjs';
import { IMAGE_KINDS, PUBLIC_ARGS, REQUIRED_GATES, expectedLabels } from '../../scripts/ops/release/policy.mjs';

export function releaseControl(dockerfileOverrides = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'polutek-release-control-'));
  const repo = path.join(directory, 'repo');
  const archive = path.join(directory, 'archive');
  mkdirSync(path.join(repo, 'bin'), { recursive: true });
  mkdirSync(path.join(archive, 'bin'), { recursive: true });
  writeFileSync(path.join(repo, 'app.txt'), 'control source, not an application\n');
  writeFileSync(path.join(repo, 'bin/tool.sh'), '#!/bin/sh\nexit 0\n');
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n.claude\n');
  chmodSync(path.join(repo, 'bin/tool.sh'), 0o755);
  const dockerfiles = {
    'deploy/serwerek/Dockerfile': [
      'ARG NODE_BASE=node:22', 'ARG FFMPEG_BASE=ffmpeg:8', 'ARG COLLECTOR_BASE=node:22-alpine',
      'FROM ${NODE_BASE} AS deps', 'FROM deps AS build', 'FROM ${NODE_BASE} AS migrator',
      'FROM ${FFMPEG_BASE} AS ffmpeg', 'FROM ${NODE_BASE} AS worker',
      'COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg',
      'FROM ${COLLECTOR_BASE} AS collector', 'FROM ${NODE_BASE} AS runner',
    ].join('\n'),
    'deploy/serwerek/Dockerfile.admin': 'ARG NODE_BASE=node:22\nFROM ${NODE_BASE} AS admin\n',
    ...dockerfileOverrides,
  };
  for (const [name, content] of Object.entries(dockerfiles)) {
    mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    writeFileSync(path.join(repo, name), content);
  }
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  git('init', '--quiet');
  git('add', '.');
  git('update-index', '--chmod=+x', 'bin/tool.sh');
  git('-c', 'user.name=Release Control', '-c', 'user.email=control@example.invalid', 'commit', '--quiet', '-m', 'control fixture');
  const source = captureGitSource(repo);
  for (const file of source.files) {
    mkdirSync(path.dirname(path.join(archive, file.path)), { recursive: true });
    copyFileSync(path.join(repo, file.path), path.join(archive, file.path));
    if (process.platform !== 'win32') chmodSync(path.join(archive, file.path), file.mode === '100755' ? 0o755 : 0o644);
  }
  const summary = { success: true, total: 3, passed: 3, failed: 0, skipped: 0, files: 1, failedFiles: [] };
  const report = {
    ok: true, head: source.revision, node: 'v22.23.4', failed: [], strictSkips: [], dirty: false, dirtyAfter: false, sourceStable: true,
    sourceBefore: source, sourceAfter: structuredClone(source),
    options: { lintAll: true, unitFull: true, build: true, strict: true, only: [], skip: [], list: false, help: false },
    results: REQUIRED_GATES.map(id => ({ id, status: 'PASS', durationMs: 1,
      ...(['unit', 'postgres', 'encode-smoke', 'critical-path'].includes(id)
        ? { testSummary: { ...structuredClone(summary), ...(id === 'critical-path' ? { files: 2 } : {}) } } : {}),
    })),
  };
  const inputs = { schema_version: 1, platform: 'linux/amd64',
    bases: { node: 'node@sha256:' + 'a'.repeat(64), ffmpeg: 'ffmpeg@sha256:' + 'b'.repeat(64), collector: 'node@sha256:' + 'c'.repeat(64) },
    public_args: Object.fromEntries(PUBLIC_ARGS.map(key => [key, key === 'NEXT_PUBLIC_APP_URL' ? 'https://example.invalid' : ''])),
  };
  const references = Object.fromEntries(IMAGE_KINDS.map(kind => [kind, `polutek-control-${kind}:fixture`]));
  const baseLayers = ['sha256:' + 'd'.repeat(64)];
  const metadata = Object.fromEntries(IMAGE_KINDS.map(kind => [kind, {
    Id: 'sha256:' + sha256(kind), Os: 'linux', Architecture: 'amd64',
    RootFS: { Layers: [...baseLayers, 'sha256:' + sha256('layer-' + kind)] },
    Config: { Labels: expectedLabels(report, inputs, source.revision, kind) },
  }]));
  const inspect = reference => {
    if (Object.values(inputs.bases).includes(reference)) return { RootFS: { Layers: baseLayers } };
    const kind = IMAGE_KINDS.find(key => references[key] === reference || metadata[key].Id === reference);
    if (!kind) throw new Error('Unknown control image');
    return metadata[kind];
  };
  return { directory, repo, archive, source, report, inputs, references, metadata, inspect, revision: source.revision };
}
