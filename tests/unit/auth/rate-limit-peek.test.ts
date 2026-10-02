import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/rate-limit";

describe("RateLimitStore.peek (used by the failed-sign-in lockout)", () => {
  it("reads a counter without counting and returns 0 for unknown keys", async () => {
    const store = new MemoryStore();
    expect(await store.peek("k")).toBe(0);
    await store.hit("k", 60_000);
    await store.hit("k", 60_000);
    expect(await store.peek("k")).toBe(2);
    expect(await store.peek("k")).toBe(2);
  });

  it("returns 0 once the window has expired", async () => {
    const store = new MemoryStore();
    await store.hit("k", 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await store.peek("k")).toBe(0);
  });
});
