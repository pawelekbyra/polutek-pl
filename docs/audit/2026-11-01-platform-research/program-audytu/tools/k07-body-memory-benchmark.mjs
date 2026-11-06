import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const implementationPath = process.env.K07_READER_PATH ?? path.join(root, 'lib/utils/request-body.ts');
const implementation = await import(pathToFileURL(implementationPath));
const { readRequestFormDataWithLimit, RequestBodyTooLargeError } = implementation.default ?? implementation;
const concurrency = 16;
const maxBytes = 6 * 1024 * 1024;
const streamChunkBytes = 64 * 1024;
const baselineRssBytes = process.memoryUsage().rss;
let peakRssBytes = baselineRssBytes;
const rssPoll = setInterval(() => {
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
}, 5);
const startedAt = performance.now();

const results = await Promise.all(Array.from({ length: concurrency }, async () => {
  const boundary = 'k07-memory-benchmark';
  const prefix = new TextEncoder().encode(`--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n`);
  let remainingBytes = maxBytes + 1 - prefix.byteLength;
  let prefixSent = false;
  const body = new ReadableStream({
    pull(controller) {
      if (!prefixSent) {
        prefixSent = true;
        controller.enqueue(prefix);
        return;
      }
      if (remainingBytes <= 0) {
        controller.close();
        return;
      }
      const chunkBytes = Math.min(streamChunkBytes, remainingBytes);
      controller.enqueue(new Uint8Array(chunkBytes).fill(0x61));
      remainingBytes -= chunkBytes;
    },
    cancel() {},
  }, { highWaterMark: 0 });
  const request = new Request('http://localhost/k07-memory-benchmark', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
    duplex: 'half',
  });
  try {
    await readRequestFormDataWithLimit(request, maxBytes, 8);
    return 'unexpected-success';
  } catch (error) {
    return error instanceof RequestBodyTooLargeError ? '413' : error.name;
  }
}));

clearInterval(rssPoll);
peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
const result = {
  scenario: 'parallel chunked multipart bodies, each exactly one byte over the application limit',
  runtime: process.version,
  implementation: process.env.K07_READER_LABEL ?? 'current worktree',
  stack: 'Node Request/ReadableStream + application reader; no Next server or reverse proxy',
  contentLength: 'absent',
  concurrency,
  maxBytesPerRequest: maxBytes,
  streamedChunkBytes: streamChunkBytes,
  outcomes: Object.fromEntries([...new Set(results)].map(outcome => [outcome, results.filter(value => value === outcome).length])),
  elapsedMs: Math.round(performance.now() - startedAt),
  baselineRssBytes,
  peakRssBytes,
  rssIncreaseBytes: peakRssBytes - baselineRssBytes,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (results.some(outcome => outcome !== '413')) process.exitCode = 1;
