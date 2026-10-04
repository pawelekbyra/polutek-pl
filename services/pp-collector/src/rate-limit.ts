/**
 * Token bucket per key, in memory (the collector is a single process). A browser sends 1-3 beacons
 * per page view, so the default (burst 20, 1 every 3 s) only stops scripts.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  private lastSweep = 0;

  constructor(
    private readonly capacity = 20,
    private readonly refillPerSecond = 1 / 3,
    private readonly maxKeys = 50_000,
  ) {}

  take(key: string, nowMs: number): boolean {
    this.sweep(nowMs);
    const bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) return false;
      this.buckets.set(key, { tokens: this.capacity - 1, at: nowMs });
      return true;
    }
    bucket.tokens = Math.min(this.capacity, bucket.tokens + ((nowMs - bucket.at) / 1000) * this.refillPerSecond);
    bucket.at = nowMs;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  get size(): number {
    return this.buckets.size;
  }

  private sweep(nowMs: number) {
    if (nowMs - this.lastSweep < 60_000) return;
    this.lastSweep = nowMs;
    const fullAfterMs = (this.capacity / this.refillPerSecond) * 1000;
    for (const [key, bucket] of this.buckets) {
      if (nowMs - bucket.at > fullAfterMs) this.buckets.delete(key);
    }
  }
}
