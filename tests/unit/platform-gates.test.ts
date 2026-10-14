import { describe, expect, it } from "vitest";
import { PLATFORM_GATE_ENV, gateMode, isGateOpen } from "@/lib/platform-gates";
import { TRUST_LEVEL_LIMITS, defaultLimitsFor } from "@/lib/platform-limits";

describe("platform gates", () => {
  it("are all off when nothing is configured (the site behaves as the single-channel site)", () => {
    expect(gateMode("channelCreation", {})).toBe("off");
    expect(gateMode("sales", {})).toBe("off");
    expect(gateMode("payouts", {})).toBe("off");
    expect(isGateOpen("sales", {})).toBe(false);
  });

  it("read exact lowercase values and ignore case and whitespace", () => {
    expect(gateMode("sales", { [PLATFORM_GATE_ENV.sales]: " ON " })).toBe("on");
    expect(gateMode("channelCreation", { [PLATFORM_GATE_ENV.channelCreation]: "Invite" })).toBe("invite");
  });

  it("treat an unknown value as off (fail closed)", () => {
    expect(gateMode("sales", { [PLATFORM_GATE_ENV.sales]: "true" })).toBe("off");
    expect(gateMode("payouts", { [PLATFORM_GATE_ENV.payouts]: "1" })).toBe("off");
    expect(gateMode("channelCreation", { [PLATFORM_GATE_ENV.channelCreation]: "everyone" })).toBe("off");
  });

  it("accept `invite` only for channel creation", () => {
    expect(gateMode("sales", { [PLATFORM_GATE_ENV.sales]: "invite" })).toBe("off");
    expect(gateMode("payouts", { [PLATFORM_GATE_ENV.payouts]: "invite" })).toBe("off");
  });

  it("`invite` is not an open gate", () => {
    expect(isGateOpen("channelCreation", { [PLATFORM_GATE_ENV.channelCreation]: "invite" })).toBe(false);
    expect(isGateOpen("channelCreation", { [PLATFORM_GATE_ENV.channelCreation]: "on" })).toBe(true);
  });
});

describe("platform limits", () => {
  it("get larger with every trust level", () => {
    for (let i = 1; i < TRUST_LEVEL_LIMITS.length; i++) {
      const prev = TRUST_LEVEL_LIMITS[i - 1];
      const next = TRUST_LEVEL_LIMITS[i];
      expect(next.maxStorageBytes).toBeGreaterThan(prev.maxStorageBytes);
      expect(next.maxUploadBytes).toBeGreaterThan(prev.maxUploadBytes);
      expect(next.maxVideoSeconds).toBeGreaterThan(prev.maxVideoSeconds);
      expect(next.maxUploadsPerDay).toBeGreaterThan(prev.maxUploadsPerDay);
    }
  });

  it("clamp unknown trust levels to the table", () => {
    expect(defaultLimitsFor(-5)).toBe(TRUST_LEVEL_LIMITS[0]);
    expect(defaultLimitsFor(Number.NaN)).toBe(TRUST_LEVEL_LIMITS[0]);
    expect(defaultLimitsFor(99)).toBe(TRUST_LEVEL_LIMITS[TRUST_LEVEL_LIMITS.length - 1]);
    expect(defaultLimitsFor(1.9)).toBe(TRUST_LEVEL_LIMITS[1]);
  });

  it("never exceed the global upload ceiling of the pipeline (50 GiB)", () => {
    for (const limits of TRUST_LEVEL_LIMITS) expect(limits.maxUploadBytes).toBeLessThanOrEqual(50 * 1024 ** 3);
  });
});
