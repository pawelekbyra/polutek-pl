import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientFingerprint, hashClientValue, resolveClientHashSecret } from "@/lib/modules/privacy";

const SECRET = "x".repeat(40);

afterEach(() => vi.unstubAllEnvs());

describe("keyed hashes of client IP addresses and user agents", () => {
  it("is not the plain SHA-256 that anyone could reverse by trying all IPv4 addresses", () => {
    const plain = crypto.createHash("sha256").update("203.0.113.7").digest("hex");
    expect(hashClientValue("203.0.113.7", { IP_HASH_SECRET: SECRET })).not.toBe(plain);
  });

  it("is stable for the same key (stored hashes stay comparable) and changes with the key", () => {
    const a = hashClientValue("203.0.113.7", { IP_HASH_SECRET: SECRET });
    expect(hashClientValue("203.0.113.7", { IP_HASH_SECRET: SECRET })).toBe(a);
    expect(hashClientValue("203.0.113.7", { IP_HASH_SECRET: "y".repeat(40) })).not.toBe(a);
    expect(hashClientValue("203.0.113.8", { IP_HASH_SECRET: SECRET })).not.toBe(a);
  });

  it("without IP_HASH_SECRET derives a key from BETTER_AUTH_SECRET that is not the auth secret itself", () => {
    const env = { BETTER_AUTH_SECRET: "auth-secret-0123456789-0123456789" };
    const derived = resolveClientHashSecret(env);
    expect(derived).not.toBe(env.BETTER_AUTH_SECRET);
    expect(resolveClientHashSecret(env)).toBe(derived);
    expect(resolveClientHashSecret({ ...env, IP_HASH_SECRET: SECRET })).toBe(SECRET);
  });

  it("refuses to run in production without any secret, but not during the build", () => {
    expect(() => resolveClientHashSecret({ NODE_ENV: "production" })).toThrow(/IP_HASH_SECRET/);
    expect(() => resolveClientHashSecret({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(() => resolveClientHashSecret({ NODE_ENV: "development" })).not.toThrow();
  });

  it("the playback fingerprint binds IP and user agent with the same key", () => {
    vi.stubEnv("IP_HASH_SECRET", SECRET);
    const fp = clientFingerprint("203.0.113.7", "UA/1");
    expect(fp).toEqual({
      ipHash: hashClientValue("203.0.113.7"),
      uaHash: hashClientValue("UA/1"),
      fingerprint: hashClientValue("203.0.113.7:UA/1"),
    });
  });
});
