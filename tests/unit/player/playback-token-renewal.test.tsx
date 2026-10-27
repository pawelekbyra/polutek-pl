/** @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_RENEW_DELAY_MS, RENEW_BEFORE_EXPIRY_MS, renewLeadMs, usePlaybackTokenRenewal } from "@/app/components/player/usePlaybackTokenRenewal";
import type { PlaybackPlan } from "@/lib/modules/playback";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const VIDEO = "c52f0407-b0e8-4b5c-b6d3-a9f152653002";
const T0 = 1_800_000_000_000;

function planExpiringIn(ms: number): PlaybackPlan {
  return {
    videoId: VIDEO,
    status: "READY",
    canPlay: true,
    access: { allowed: true },
    source: { provider: "SELF_HLS", kind: "self_hls", playbackUrl: `https://v.test/h/x.y/${VIDEO}/v1/master.m3u8`, expiresAt: new Date(Date.now() + ms).toISOString(), isSignedUrl: true },
    tracking: { playbackSessionId: "sess-1", heartbeatIntervalSeconds: 15 },
  } as unknown as PlaybackPlan;
}

describe("playback token renewal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renewLeadMs: 2 minutes for a normal token, half of what is left for a short one", () => {
    expect(renewLeadMs(30 * 60_000)).toBe(RENEW_BEFORE_EXPIRY_MS);
    expect(renewLeadMs(60_000)).toBe(30_000);
    expect(renewLeadMs(-5)).toBe(0);
  });

  it("keeps a watch longer than the token alive: renews 2 minutes before every 30 minute expiry, with the same session", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: string) => {
      urls.push(input);
      return new Response(JSON.stringify(planExpiringIn(30 * 60_000)), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const setPlan = vi.fn((p: PlaybackPlan) => rerender({ plan: p }));
    const { rerender } = renderHook(
      (props: { plan: PlaybackPlan }) =>
        usePlaybackTokenRenewal({ videoId: VIDEO, plan: props.plan, generationRef: { current: 0 }, setPlan, refresh: vi.fn(async () => undefined) }),
      { initialProps: { plan: planExpiringIn(30 * 60_000) } },
    );

    // Nothing happens before the lead point.
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000 - RENEW_BEFORE_EXPIRY_MS - 1000); });
    expect(fetchMock).not.toHaveBeenCalled();
    // First renewal, strictly before the token expires.
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls[0]).toBe(`/api/media-source/${VIDEO}?session=sess-1`);
    // A two hour watch needs 4+ renewals, each one a fresh server-checked plan.
    for (let minute = 0; minute < 120; minute++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    }
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(setPlan.mock.calls.length).toBe(fetchMock.mock.calls.length);
  });

  it("a token cut short by the end of a grant does not cause a request storm", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(planExpiringIn(20_000)), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const setPlan = vi.fn((p: PlaybackPlan) => rerender({ plan: p }));
    const { rerender } = renderHook(
      (props: { plan: PlaybackPlan }) =>
        usePlaybackTokenRenewal({ videoId: VIDEO, plan: props.plan, generationRef: { current: 0 }, setPlan, refresh: vi.fn(async () => undefined) }),
      { initialProps: { plan: planExpiringIn(20_000) } },
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    // The server keeps answering "20 s left" (the grant ends then): at most one request per MIN_RENEW_DELAY_MS.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(Math.ceil(60_000 / MIN_RENEW_DELAY_MS));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
  });

  it("when the server refuses the renewal, the access state is re-checked instead of keeping the stale token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "PASS_REQUIRED", canPlay: false, videoId: VIDEO, access: { allowed: false } }), { status: 200 })));
    const refresh = vi.fn(async () => undefined);
    const setPlan = vi.fn();
    renderHook(() => usePlaybackTokenRenewal({ videoId: VIDEO, plan: planExpiringIn(60_000), generationRef: { current: 0 }, setPlan, refresh }));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(setPlan).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });
});
