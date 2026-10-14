/** @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/app/components/player/video-progress-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/components/player/video-progress-client")>();
  return { ...actual, sendProgressToServer: sent.send };
});

import { resetPageStartForTests, useVideoProgress } from "@/app/components/player/useVideoProgress";
import { readGuestProgress, writeGuestProgress } from "@/app/components/player/video-progress-client";

type FakePlayer = { currentTime: number; duration: number; paused: boolean; state: { canPlay: boolean } };

function makePlayer(over: Partial<FakePlayer> = {}): { current: FakePlayer } {
  return { current: { currentTime: 0, duration: 600, paused: false, state: { canPlay: true }, ...over } };
}

function setup(options: {
  player?: { current: FakePlayer };
  signedIn?: boolean;
  server?: number | null | undefined;
  videoId?: string;
  gateHeld?: boolean;
}) {
  const player = options.player ?? makePlayer();
  const hook = renderHook(
    (props: { server: number | null | undefined; videoId: string }) =>
      useVideoProgress({
        playerRef: player as never,
        videoId: props.videoId,
        signedIn: options.signedIn ?? true,
        serverPositionSeconds: props.server,
        isGateHeld: () => options.gateHeld ?? false,
      }),
    { initialProps: { server: options.server, videoId: options.videoId ?? "vid-1" } },
  );
  return { player, ...hook };
}

describe("useVideoProgress: start position", () => {
  beforeEach(() => {
    resetPageStartForTests();
    localStorage.clear();
    sent.send.mockReset();
    window.history.replaceState({}, "", "/");
  });
  afterEach(() => cleanup());

  it("starts at the saved position and says so (a ready player jumps at once)", () => {
    const { player, result } = setup({ server: 300 });
    expect(player.current.currentTime).toBe(300);
    expect(result.current.notice).toEqual({ seconds: 300, source: "resume" });
  });

  it("applies the saved position when the player becomes ready (applyStart from canplay)", () => {
    const player = makePlayer({ state: { canPlay: false } });
    const { result } = setup({ player, server: 300 });
    expect(player.current.currentTime).toBe(0);
    act(() => {
      expect(result.current.applyStart()).toBe(true);
    });
    expect(player.current.currentTime).toBe(300);
    expect(result.current.notice).toEqual({ seconds: 300, source: "resume" });
  });

  it("?t= wins over the saved position, and the address loses ?t=", () => {
    window.history.replaceState({}, "", "/?v=film&t=1m30s");
    const { player, result } = setup({ server: 300 });
    expect(player.current.currentTime).toBe(90);
    expect(result.current.notice).toEqual({ seconds: 90, source: "link" });
    expect(window.location.search).toBe("?v=film");
  });

  it("clamps ?t= to the length of the video", () => {
    window.history.replaceState({}, "", "/?t=99999");
    const { player, result } = setup({ server: null });
    act(() => {
      result.current.applyStart();
    });
    // 99999 s is above the 24 h limit: not a start time at all, so nothing is applied.
    expect(player.current.currentTime).toBe(0);
    cleanup();
    resetPageStartForTests();

    window.history.replaceState({}, "", "/?t=900");
    const second = setup({ server: null });
    act(() => {
      second.result.current.applyStart();
    });
    expect(second.player.current.currentTime).toBe(599);
  });

  it("an invalid ?t= is ignored (the saved position applies) and removed from the address", () => {
    window.history.replaceState({}, "", "/?v=film&t=abc");
    const { player, result } = setup({ server: 120 });
    act(() => {
      result.current.applyStart();
    });
    expect(player.current.currentTime).toBe(120);
    expect(window.location.search).toBe("?v=film");
  });

  it("?t=0 starts from the beginning even when a position is saved", () => {
    window.history.replaceState({}, "", "/?t=0");
    const { player, result } = setup({ server: 300 });
    act(() => {
      expect(result.current.applyStart()).toBe(false);
    });
    expect(player.current.currentTime).toBe(0);
    expect(result.current.notice).toBeNull();
  });

  it("applies the start once per video", () => {
    const { player, result } = setup({ server: 300 });
    act(() => {
      result.current.applyStart();
    });
    player.current.currentTime = 10;
    act(() => {
      expect(result.current.applyStart()).toBe(false);
    });
    expect(player.current.currentTime).toBe(10);
  });

  it("waits for a saved position that has not arrived yet, then jumps to it", () => {
    const { player, result, rerender } = setup({ server: undefined });
    act(() => {
      expect(result.current.applyStart()).toBe(false);
    });
    expect(player.current.currentTime).toBe(0);

    rerender({ server: 240, videoId: "vid-1" });
    expect(player.current.currentTime).toBe(240);
    expect(result.current.notice?.source).toBe("resume");
  });

  it("does not jump when the viewer has already moved on", () => {
    const player = makePlayer({ currentTime: 20 });
    const { result, rerender } = setup({ player, server: undefined });
    rerender({ server: 240, videoId: "vid-1" });
    expect(player.current.currentTime).toBe(20);
    expect(result.current.notice).toBeNull();
  });

  it("applies the start to the element the gate hands in", () => {
    const { player, result } = setup({ server: 200, gateHeld: true });
    const target = { currentTime: 0 };
    act(() => {
      result.current.applyStart(target);
    });
    expect(target.currentTime).toBe(200);
    expect(player.current.currentTime).toBe(0);
  });

  it("'From the beginning' goes back to zero and clears the notice", () => {
    const { player, result } = setup({ server: 300 });
    act(() => {
      result.current.applyStart();
    });
    act(() => result.current.startOver());
    expect(player.current.currentTime).toBe(0);
    expect(result.current.notice).toBeNull();
  });

  it("a guest resumes from the position kept in the browser", () => {
    writeGuestProgress("vid-1", 150, 600);
    const { player, result } = setup({ signedIn: false, server: null });
    act(() => {
      result.current.applyStart();
    });
    expect(player.current.currentTime).toBe(150);
  });
});

describe("useVideoProgress: position reports", () => {
  beforeEach(() => {
    resetPageStartForTests();
    localStorage.clear();
    sent.send.mockReset();
    window.history.replaceState({}, "", "/");
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("a signed-in viewer reports every 10 seconds while the video plays", () => {
    const player = makePlayer({ currentTime: 42, paused: false });
    setup({ player, server: null });

    vi.advanceTimersByTime(10_000);
    expect(sent.send).toHaveBeenCalledTimes(1);
    expect(sent.send).toHaveBeenCalledWith("vid-1", 42, 600, { beacon: false });

    // The same second again is not sent twice.
    vi.advanceTimersByTime(10_000);
    expect(sent.send).toHaveBeenCalledTimes(1);
  });

  it("reports nothing while paused or in the first 5 seconds", () => {
    const player = makePlayer({ currentTime: 3, paused: false });
    setup({ player, server: null });
    vi.advanceTimersByTime(10_000);
    expect(sent.send).not.toHaveBeenCalled();

    player.current.currentTime = 50;
    player.current.paused = true;
    vi.advanceTimersByTime(10_000);
    expect(sent.send).not.toHaveBeenCalled();
  });

  it("reports nothing until the saved position is known (an old one is never overwritten)", () => {
    const player = makePlayer({ currentTime: 40, paused: false });
    const { rerender } = setup({ player, server: undefined });
    vi.advanceTimersByTime(10_000);
    expect(sent.send).not.toHaveBeenCalled();

    rerender({ server: null, videoId: "vid-1" });
    vi.advanceTimersByTime(10_000);
    expect(sent.send).toHaveBeenCalledTimes(1);
  });

  it("saveNow (pause) reports at once, and the tab closing goes out as a beacon", () => {
    const player = makePlayer({ currentTime: 77, paused: true });
    const { result } = setup({ player, server: null });

    act(() => result.current.saveNow(false));
    expect(sent.send).toHaveBeenLastCalledWith("vid-1", 77, 600, { beacon: false });

    window.dispatchEvent(new Event("pagehide"));
    expect(sent.send).toHaveBeenLastCalledWith("vid-1", 77, 600, { beacon: true });
  });

  it("a hidden tab reports with a beacon", () => {
    const player = makePlayer({ currentTime: 61, paused: false });
    setup({ player, server: null });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });

    expect(sent.send).toHaveBeenCalledWith("vid-1", 61, 600, { beacon: true });
  });

  it("nothing is reported while the entry gate holds the hero", () => {
    const player = makePlayer({ currentTime: 61, paused: false });
    setup({ player, server: null, gateHeld: true });
    vi.advanceTimersByTime(10_000);
    expect(sent.send).not.toHaveBeenCalled();
  });

  it("a guest keeps the position in the browser and sends nothing to the server", () => {
    const player = makePlayer({ currentTime: 90, paused: false });
    setup({ player, signedIn: false, server: null });
    vi.advanceTimersByTime(10_000);

    expect(sent.send).not.toHaveBeenCalled();
    expect(readGuestProgress("vid-1")).toEqual({ positionSeconds: 90, durationSeconds: 600 });
  });

  it("a guest's finished video (past 95 %) is forgotten", () => {
    writeGuestProgress("vid-1", 100, 600);
    const player = makePlayer({ currentTime: 590, paused: false });
    setup({ player, signedIn: false, server: null });
    vi.advanceTimersByTime(10_000);
    expect(readGuestProgress("vid-1")).toBeNull();
  });

  it("reports the last position of the video it leaves", () => {
    const player = makePlayer({ currentTime: 120, paused: false });
    const { result, rerender } = setup({ player, server: null });
    act(() => result.current.noteTime(120, 600));

    rerender({ server: null, videoId: "vid-2" });
    expect(sent.send).toHaveBeenCalledWith("vid-1", 120, 600, { beacon: true });
  });
});
