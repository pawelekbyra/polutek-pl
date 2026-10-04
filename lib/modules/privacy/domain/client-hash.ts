import crypto from "crypto";

/** Label for deriving the key from BETTER_AUTH_SECRET, so the two secrets are never the same bytes. */
const DERIVATION_LABEL = "pawelperfect/ip-hash/v1";
const DEV_ONLY_SECRET = "dev-only-ip-hash-secret-0123456789abcdef";

/**
 * Key for hashing client IPs and user agents. `IP_HASH_SECRET` when set; otherwise derived
 * deterministically from `BETTER_AUTH_SECRET` (required in production anyway), so a deploy without
 * the new variable keeps working and keeps producing the same hashes across restarts.
 */
export function resolveClientHashSecret(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.IP_HASH_SECRET?.trim();
  if (explicit) return explicit;
  const authSecret = env.BETTER_AUTH_SECRET?.trim();
  if (authSecret) return crypto.createHmac("sha256", authSecret).update(DERIVATION_LABEL).digest("hex");
  if (env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("IP_HASH_SECRET (or BETTER_AUTH_SECRET) is required in production.");
  }
  return DEV_ONLY_SECRET;
}

/**
 * Keyed hash (HMAC-SHA256) of a client identifier such as an IP address or user agent. A plain
 * SHA-256 of an IPv4 address can be reversed by trying all 2^32 addresses; without the key this
 * cannot. Same input and key always give the same value, so stored hashes stay comparable.
 */
export function hashClientValue(value: string, env?: Record<string, string | undefined>): string {
  return crypto.createHmac("sha256", resolveClientHashSecret(env)).update(value).digest("hex");
}

/** The three values a playback request is bound to: IP, user agent and both together. */
export function clientFingerprint(ip: string, userAgent: string) {
  return {
    ipHash: hashClientValue(ip),
    uaHash: hashClientValue(userAgent),
    fingerprint: hashClientValue(`${ip}:${userAgent}`),
  };
}
