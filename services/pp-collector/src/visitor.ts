import { createHash } from 'node:crypto';

const warsawDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar day in Europe/Warsaw as YYYY-MM-DD (the unit of the salt and of every daily aggregate). */
export function warsawDay(now: Date): string {
  return warsawDate.format(now);
}

/**
 * Daily visitor id: the first 64 bits of SHA-256(salt, IP, user agent, host), as a signed bigint. The
 * same person on the same day gets the same id; with the salt deleted after the day, ids from different
 * days cannot be linked and the IP cannot be recovered (the scheme Plausible uses).
 */
export function visitorHash(salt: Buffer, ip: string, userAgent: string, host: string): bigint {
  const digest = createHash('sha256')
    .update(salt)
    .update('\u0000')
    .update(ip)
    .update('\u0000')
    .update(userAgent)
    .update('\u0000')
    .update(host)
    .digest();
  return digest.readBigInt64BE(0);
}

/** The client's random 16-hex-digit attempt id as a signed 64-bit integer. */
export function attemptId(hex: string): bigint {
  return BigInt.asIntN(64, BigInt(`0x${hex}`));
}

/** 25 hex digits (MSB first) -> the 100-character bit string Postgres reads into bit(100). */
export function watchedBits(hex: string): string {
  return [...hex].map((digit) => parseInt(digit, 16).toString(2).padStart(4, '0')).join('');
}

export interface SaltStore {
  /** Returns the salt of `day`, creating it once (concurrent callers get the same value). */
  getOrCreate(day: string): Promise<Buffer>;
  /** Deletes every salt older than `day`. */
  deleteBefore(day: string): Promise<void>;
}

/** In-memory cache in front of the store: one database round trip per day. */
export class SaltCache {
  private day: string | null = null;
  private salt: Buffer | null = null;
  private pending: Promise<Buffer> | null = null;

  constructor(private readonly store: SaltStore) {}

  async get(now: Date): Promise<Buffer> {
    const day = warsawDay(now);
    if (this.day === day && this.salt) return this.salt;
    if (this.pending && this.day === day) return this.pending;
    this.day = day;
    this.salt = null;
    this.pending = (async () => {
      const salt = await this.store.getOrCreate(day);
      await this.store.deleteBefore(day);
      if (this.day === day) this.salt = salt;
      return salt;
    })();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }
}
