import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authRateLimitStorage,
  hitAuthCounter,
  peekAuthCounter,
  setAuthRateLimitStoreForTests,
} from "@/lib/auth/rate-limit-storage";
import { UpstashRedisStore, type RateLimitStore } from "@/lib/rate-limit";

const brokenStore: RateLimitStore = {
  hit: async () => {
    throw new Error("gateway down");
  },
  peek: async () => {
    throw new Error("gateway down");
  },
  setNxEx: async () => {
    throw new Error("gateway down");
  },
};

afterEach(() => {
  setAuthRateLimitStoreForTests(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("auth rate-limit storage when Redis fails (AUTH-12)", () => {
  it("lets the request through instead of failing sign-in", async () => {
    setAuthRateLimitStoreForTests(brokenStore);
    await expect(authRateLimitStorage.consume("sign-in", { window: 60, max: 1 })).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
  });

  it("reads and counts lockout counters as 0 instead of throwing", async () => {
    setAuthRateLimitStoreForTests(brokenStore);
    await expect(peekAuthCounter("signin-fail:x")).resolves.toBe(0);
    await expect(hitAuthCounter("signin-fail:x", 60)).resolves.toBe(0);
  });
});

describe("UpstashRedisStore timeout", () => {
  it("aborts a hung gateway call instead of waiting for ever", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = new UpstashRedisStore("https://redis.invalid", "token", 20);

    await expect(store.peek("k")).rejects.toBeTruthy();
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
