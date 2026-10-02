// @vitest-environment jsdom
/** F-10: One Tap is offered at most once a day, and not underneath the home entry gate. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const h = vi.hoisted(() => ({
  oneTap: vi.fn(),
  createAuthClient: vi.fn(),
  auth: { isLoaded: true, isSignedIn: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("better-auth/react", () => ({ createAuthClient: (...args: unknown[]) => h.createAuthClient(...args) }));
vi.mock("better-auth/client/plugins", () => ({ oneTapClient: () => ({}) }));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: "gid", turnstileSiteKey: null }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => h.auth, refreshSession: vi.fn() }));

import GoogleOneTapPrompt, { ONE_TAP_COOLDOWN_MS, ONE_TAP_STORAGE_KEY } from "@/app/components/auth/GoogleOneTapPrompt";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.auth.isLoaded = true;
  h.auth.isSignedIn = false;
  h.oneTap.mockResolvedValue(undefined);
  h.createAuthClient.mockReturnValue({ oneTap: h.oneTap });
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/en");
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("GoogleOneTapPrompt (F-10)", () => {
  it("prompts a guest once after a short delay and remembers it", async () => {
    render(<GoogleOneTapPrompt />);
    expect(h.oneTap).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(h.oneTap).toHaveBeenCalledTimes(1);
    expect(Number(window.localStorage.getItem(ONE_TAP_STORAGE_KEY))).toBeGreaterThan(0);
  });

  it("does not prompt again within a day, but does after the cooldown", async () => {
    window.localStorage.setItem(ONE_TAP_STORAGE_KEY, String(Date.now() - 1000));
    render(<GoogleOneTapPrompt />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(h.oneTap).not.toHaveBeenCalled();
    cleanup();
    window.localStorage.setItem(ONE_TAP_STORAGE_KEY, String(Date.now() - ONE_TAP_COOLDOWN_MS - 1000));
    render(<GoogleOneTapPrompt />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(h.oneTap).toHaveBeenCalledTimes(1);
  });

  it("waits for the home entry gate to be passed", async () => {
    document.body.innerHTML = '<div data-testid="site-preloader"></div>';
    render(<GoogleOneTapPrompt />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(h.oneTap).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new Event("polutek:gate-enter"));
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(h.oneTap).toHaveBeenCalledTimes(1);
  });

  it("never prompts signed-in visitors or the auth return pages", async () => {
    h.auth.isSignedIn = true;
    render(<GoogleOneTapPrompt />);
    cleanup();
    h.auth.isSignedIn = false;
    window.history.replaceState(null, "", "/sso-callback");
    render(<GoogleOneTapPrompt />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(h.oneTap).not.toHaveBeenCalled();
  });

  it("builds the One Tap client once", async () => {
    render(<GoogleOneTapPrompt />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(h.createAuthClient).toHaveBeenCalledTimes(1);
  });
});
