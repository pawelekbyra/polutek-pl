import { describe, expect, it } from 'vitest';
import { run } from '@/scripts/hls/encode-hls.mjs';

// Audit S04: ffprobe on an untrusted source must not hold the single encoder forever or fill its memory.
// The child here is node itself, so the test needs no ffmpeg.
const node = process.execPath;

describe('run() limits for child processes', () => {
  it('kills a child that outlives timeoutMs and rejects with TimeoutError', async () => {
    const started = Date.now();
    await expect(run(node, ['-e', 'setTimeout(() => {}, 60000)'], { timeoutMs: 300 })).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('kills a child whose stdout grows past maxStdoutBytes and rejects with OutputLimitError', async () => {
    await expect(
      run(node, ['-e', 'setInterval(() => process.stdout.write("x".repeat(100000)), 5)'], { maxStdoutBytes: 250_000, timeoutMs: 20_000 }),
    ).rejects.toMatchObject({ name: 'OutputLimitError' });
  });

  it('still resolves a child that finishes within both limits', async () => {
    const { stdout } = await run(node, ['-e', 'process.stdout.write("ok")'], { timeoutMs: 20_000, maxStdoutBytes: 1000 });
    expect(stdout).toBe('ok');
  });

  it('an abort signal still wins and rejects with AbortError', async () => {
    const controller = new AbortController();
    const pending = run(node, ['-e', 'setTimeout(() => {}, 60000)'], { signal: controller.signal, timeoutMs: 30_000 });
    setTimeout(() => controller.abort(), 200);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
