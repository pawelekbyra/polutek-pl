import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@admin/lib/actions/rate-limit";

const rule = { bucket: "b", max: 2, windowMs: 1000 };
beforeEach(resetRateLimits);

describe("checkRateLimit", () => {
  it("allows max hits per window, then says when to retry; the window slides", () => {
    expect(checkRateLimit("a", rule, 0)).toEqual({ ok: true });
    expect(checkRateLimit("a", rule, 100)).toEqual({ ok: true });
    expect(checkRateLimit("a", rule, 200)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(checkRateLimit("a", rule, 1001)).toEqual({ ok: true });
  });
  it("counts per actor and per bucket", () => {
    checkRateLimit("a", rule, 0); checkRateLimit("a", rule, 1);
    expect(checkRateLimit("b", rule, 2)).toEqual({ ok: true });
    expect(checkRateLimit("a", { ...rule, bucket: "other" }, 2)).toEqual({ ok: true });
  });
});
