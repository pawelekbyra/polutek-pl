import { beforeEach, describe, expect, it } from "vitest";
import { allowAction, resetRateLimits, retryAfterSeconds } from "@admin/lib/actions/rate-limit";

const rule = { key: "t", max: 3, windowMs: 60_000 };
beforeEach(() => resetRateLimits());

describe("allowAction", () => {
  it("allows max hits per window per admin and action, then refuses until the oldest hit leaves", () => {
    const t0 = 1_000_000;
    expect([1, 2, 3, 4].map((i) => allowAction("a1", rule, t0 + i))).toEqual([true, true, true, false]);
    expect(retryAfterSeconds("a1", rule, t0 + 10_000)).toBe(51);
    expect(allowAction("a1", rule, t0 + 61_000)).toBe(true);
  });

  it("counts admins and actions separately", () => {
    for (let i = 0; i < 3; i++) allowAction("a1", rule, 5);
    expect(allowAction("a2", rule, 6)).toBe(true);
    expect(allowAction("a1", { ...rule, key: "other" }, 6)).toBe(true);
    expect(allowAction("a1", rule, 6)).toBe(false);
  });
});
