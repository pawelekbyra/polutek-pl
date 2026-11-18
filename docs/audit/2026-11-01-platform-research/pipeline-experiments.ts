import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { processEncodeJob } from '../../../lib/modules/video-pipeline/application/process-encode-job';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function harness(mode: 'failed-upload' | 'lost-during-finalize' | 'lost-while-uploading') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'polutek-research-'));
  const objects = new Set<string>();
  const events: string[] = [];
  let owned = true;
  let firstPut = true;
  const job: any = { id: 'job-test', videoId: 'video-test', originalId: 'original-test', versionNumber: 1, attemptCount: 1, maxAttempts: 3 };
  const ports: any = {
    workerId: 'worker-A', workRoot: root, now: () => new Date(), heartbeatIntervalMs: 5,
    store: {
      reportProgress: async () => ({ owned, cancelRequested: false }),
      markSucceeded: async () => owned,
      markFailedOrRetry: async () => true,
      markCancelled: async () => true,
      release: async () => true
    },
    originals: { loadOriginal: async () => ({ objectKey: 'source.mp4', sizeBytes: 1 }), download: async () => 1 },
    encoder: {
      probe: async () => ({ width: 640, height: 360, duration: 5, hasAudio: false, hdr: false }),
      encode: async ({ out }: any) => {
        await mkdir(path.join(out, '360p'), { recursive: true });
        for (const f of ['master.m3u8', '360p/index.m3u8', '360p/init.mp4', '360p/seg_00001.m4s', 'poster.jpg']) await writeFile(path.join(out, f), 'fixture');
        return { meta: { source: { durationSeconds: 5 }, rungs: [] }, issues: [] };
      }
    },
    hls: {
      bucket: 'fake-local-storage',
      putFile: async (key: string) => {
        if (mode === 'failed-upload') {
          if (firstPut) { firstPut = false; events.push('one PUT fails'); throw new Error('simulated transient storage error'); }
          await sleep(60);
        }
        objects.add(key); events.push('PUT committed');
        if (mode === 'lost-while-uploading' && firstPut) {
          firstPut = false; owned = false;
          objects.add('videos/video-test/v/v1/new-owner-segment.m4s');
          events.push('claim reassigned; new owner writes into same version prefix');
        }
        return 1;
      },
      exists: async () => true,
      countPrefix: async () => objects.size,
      deletePrefix: async () => { events.push('DELETE prefix'); const n = objects.size; objects.clear(); return n; }
    },
    finalizer: {
      findExisting: async () => null,
      finalize: async () => {
        events.push('finalization entered');
        if (mode === 'lost-during-finalize') { owned = false; await sleep(30); }
        events.push('publication side effect');
        return { assetId: 'asset-test' };
      }
    },
    audit: async () => {}, log: () => {}
  };
  try {
    const result = await processEncodeJob(job, ports);
    const objectsAtReturn = objects.size;
    await sleep(100);
    return { mode, result, objectsAtReturn, objectsAfterPendingPuts: objects.size, events };
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function main() {
  const results = [];
  for (const mode of ['failed-upload', 'lost-during-finalize', 'lost-while-uploading'] as const) results.push(await harness(mode));
  console.log(JSON.stringify(results, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
