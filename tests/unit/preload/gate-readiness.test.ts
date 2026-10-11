import { describe, expect, it } from "vitest";
import {
  GATE_SOUND_MAX_WAIT_MS,
  PAGE_REVEAL_MAX_WAIT_MS,
  PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS,
  entryKind,
  isAssetSettled,
  isGateOpen,
  waitUntilLimitMs,
  type GateReadinessInput,
} from "@/app/components/preload/gate-readiness";

const base: GateReadinessInput = {
  authLoaded: true,
  pagePiecesReady: true,
  pageLimitReached: false,
  sound: "ready",
  vector: "ready",
  soundLimitReached: false,
};
const input = (patch: Partial<GateReadinessInput>): GateReadinessInput => ({ ...base, ...patch });

describe("the entry gate's readiness policy", () => {
  it("waits for the sound much longer than for the page, and below the 30 s CSS failsafe", () => {
    expect(PAGE_REVEAL_MAX_WAIT_MS).toBe(6000);
    expect(GATE_SOUND_MAX_WAIT_MS).toBeGreaterThanOrEqual(20000);
    expect(GATE_SOUND_MAX_WAIT_MS).toBeLessThan(30000);
  });

  it("opens when the page and the sound are ready", () => {
    expect(isGateOpen(base)).toBe(true);
  });

  it("is NOT open at the page limit while the sound is still not ready", () => {
    // 6 s: the page limit passed, the sound is still being decoded (a slow machine).
    expect(isGateOpen(input({ sound: "pending", pagePiecesReady: false, pageLimitReached: true }))).toBe(false);
    expect(isGateOpen(input({ sound: "pending", pageLimitReached: true }))).toBe(false);
    // The rabbit vector's warm-up counts too.
    expect(isGateOpen(input({ vector: "pending" }))).toBe(false);
  });

  it("opens once the sound is ready, even when a page piece never settled (page limit reached)", () => {
    expect(isGateOpen(input({ pagePiecesReady: false, pageLimitReached: true, sound: "ready" }))).toBe(true);
    expect(isGateOpen(input({ authLoaded: false, pageLimitReached: true }))).toBe(true);
  });

  it("holds for the page until its limit even when the sound is ready", () => {
    expect(isGateOpen(input({ pagePiecesReady: false }))).toBe(false);
    expect(isGateOpen(input({ authLoaded: false }))).toBe(false);
  });

  it("opens when the sound failed for good (the entry is then the plain fade)", () => {
    expect(isGateOpen(input({ sound: "failed" }))).toBe(true);
    expect(entryKind({ canWarp: true, soundReady: false })).toBe("fade");
  });

  it("opens at the sound's long limit with the sound still pending (then: the plain fade)", () => {
    expect(isGateOpen(input({ sound: "pending", soundLimitReached: true }))).toBe(true);
    // ...but not before the page itself is settled or its own limit is out.
    expect(isGateOpen(input({ sound: "pending", soundLimitReached: true, pagePiecesReady: false }))).toBe(false);
  });

  it("does not wait for assets a device does not need (no warp: reduced motion, no canvas)", () => {
    expect(isAssetSettled("not-needed")).toBe(true);
    expect(isGateOpen(input({ sound: "not-needed", vector: "not-needed" }))).toBe(true);
    expect(entryKind({ canWarp: false, soundReady: false })).toBe("fade");
  });

  it("enters with the warp only with a decoded sound on a device that can play it", () => {
    expect(entryKind({ canWarp: true, soundReady: true })).toBe("warp");
    expect(entryKind({ canWarp: false, soundReady: true })).toBe("fade");
    expect(entryKind({ canWarp: true, soundReady: false })).toBe("fade");
  });

  it("measures the limits from the navigation start, at least a moment after mount", () => {
    expect(waitUntilLimitMs(6000, 1500)).toBe(4500);
    expect(waitUntilLimitMs(25000, 1500)).toBe(23500);
    expect(waitUntilLimitMs(6000, 9000)).toBe(PAGE_REVEAL_MIN_WAIT_AFTER_MOUNT_MS);
  });
});
