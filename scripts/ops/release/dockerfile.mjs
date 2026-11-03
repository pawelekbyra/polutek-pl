import { readFileSync } from 'node:fs';
import path from 'node:path';
import { requireValue } from './source.mjs';

/** A deliberately narrow Dockerfile contract, not a general Dockerfile parser. Fail closed on new syntax. */
export function validateDockerfileBases(sourceRoot) {
  for (const [file, targets] of [
    ['deploy/serwerek/Dockerfile', ['runner', 'migrator', 'worker', 'collector', 'ffmpeg']],
    ['deploy/serwerek/Dockerfile.admin', ['admin']],
  ]) {
    const text = readFileSync(path.join(sourceRoot, file), 'utf8');
    requireValue(!/^\s*#\s*(syntax|escape)\s*=/mi.test(text), 'Dockerfile parser directives require review');
    const instructions = text.replace(/\\\r?\n/g, ' ').split(/\r?\n/)
      .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    const stages = new Set();
    const globalArgs = new Set();
    for (const line of instructions) {
      if (stages.size === 0 && /^ARG\s/i.test(line)) {
        const match = /^ARG\s+([A-Z_]+)(?:=.*)?$/i.exec(line);
        requireValue(match, 'Unsupported Dockerfile global ARG syntax');
        globalArgs.add(match[1]);
      }
      if (/^FROM\s/i.test(line)) {
        const match = /^FROM\s+(\S+)\s+AS\s+([a-z0-9_-]+)$/i.exec(line);
        requireValue(match, 'Unsupported Dockerfile FROM syntax');
        const [, source, rawName] = match;
        const name = rawName.toLowerCase();
        requireValue(!stages.has(name), 'Duplicate Dockerfile stage');
        if (!stages.has(source.toLowerCase())) {
          const arg = name === 'ffmpeg' ? 'FFMPEG_BASE' : name === 'collector' ? 'COLLECTOR_BASE' : 'NODE_BASE';
          requireValue(source === '${' + arg + '}' && globalArgs.has(arg), 'Dockerfile external base must consume its pinned build argument');
        } else {
          requireValue(!['ffmpeg', 'collector'].includes(name), 'Dockerfile media/collector base must consume its pinned argument');
        }
        stages.add(name);
      }
      if (/^(COPY|ADD)\s/i.test(line)) {
        // Named contexts and external image COPY are not part of this release protocol.
        const from = /(?:^|\s)--from(?:=|\s+)(\S+)/i.exec(line)?.[1];
        if (from) requireValue(stages.has(from.toLowerCase()), 'Dockerfile COPY source must be a previously declared local stage');
      }
      requireValue(!/^RUN\s.*--mount=[^\n]*\bfrom=/i.test(line), 'Dockerfile mounted external sources require review');
    }
    requireValue(targets.every(target => stages.has(target)), 'Dockerfile release target is missing');
  }
}
