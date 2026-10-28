// @vitest-environment jsdom
/**
 * F-14, S02, S03: the saved language is applied again when a different user signs in, an address that names a
 * language beats the account, and only a deliberate choice is saved on the account (one at a time, retried).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  setLanguage: vi.fn(),
  user: { current: null as null | { id: string; language: string } },
  language: { current: "en" },
  choice: { current: null as null | { language: string; seq: number } },
  refreshSession: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn(),
  toast: vi.fn(),
  real: { current: { pathname: "/", search: "" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: vi.fn() }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/app/components/subscriptions/UnsubscribedEmailConsentPrompt", () => ({ default: () => null }));
vi.mock("@/app/hooks/useToast", () => ({ useOptionalToast: () => h.toast }));
vi.mock("@/lib/i18n/real-location", () => ({ readRealLocation: () => h.real.current }));
vi.mock("@/app/components/LanguageContext", () => ({
  useLanguage: () => ({
    language: h.language.current,
    tx: txFor(h.language.current as "pl"),
    setLanguage: h.setLanguage,
    choice: h.choice.current,
    isInitialized: true,
  }),
}));
vi.mock("@/lib/auth/react", () => ({
  useUser: () => ({ user: h.user.current, isLoaded: true }),
  refreshSession: h.refreshSession,
}));

import AuthLifecycleProvider from "@/app/components/auth/AuthLifecycleProvider";
import { txFor } from "../i18n/mock-language";

beforeEach(() => {
  vi.clearAllMocks();
  h.fetch.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", h.fetch);
  h.language.current = "en";
  h.choice.current = null;
  h.user.current = null;
  h.real.current = { pathname: "/", search: "" };
  // The switch itself (history) is not under test here.
  vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AuthLifecycleProvider language sync (F-14, S02)", () => {
  it("applies each signed-in user's saved language on a bare address, also after another user signed out and in", () => {
    h.user.current = { id: "a", language: "pl" };
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.setLanguage).toHaveBeenCalledWith("pl");

    // sign out, then a different user whose saved language is English signs in while the UI shows Polish
    h.language.current = "pl";
    h.setLanguage.mockClear();
    h.user.current = null;
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.user.current = { id: "b", language: "en" };
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.setLanguage).toHaveBeenCalledWith("en");
  });

  it("keeps the language of an address that names one: the account does not change half the page", () => {
    h.real.current = { pathname: "/de/search", search: "?q=film" };
    h.language.current = "de";
    h.user.current = { id: "a", language: "pl" };
    render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.setLanguage).not.toHaveBeenCalled();
  });

  it("does not write the address's language over the account either (it was not a choice)", async () => {
    h.real.current = { pathname: "/en/channel/x", search: "" };
    h.language.current = "en";
    h.user.current = { id: "a", language: "pl" };
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.fetch).not.toHaveBeenCalled();
  });
});

describe("AuthLifecycleProvider language save (S03)", () => {
  it("saves a deliberate choice on the account once, then re-reads the session", async () => {
    h.user.current = { id: "a", language: "pl" };
    h.language.current = "pl";
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.fetch).not.toHaveBeenCalled();

    h.language.current = "en";
    h.choice.current = { language: "en", seq: 1 }; // e.g. the navbar switcher or the first-sign-in dialog
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);

    await waitFor(() => expect(h.refreshSession).toHaveBeenCalledTimes(1));
    expect(h.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetch.mock.calls[0]!;
    expect(url).toBe("/api/user/language");
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ language: "en" }) });
  });

  it("a language that merely changed (no choice) is not saved", async () => {
    h.user.current = { id: "a", language: "pl" };
    h.language.current = "pl";
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.language.current = "en";
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("does not treat a refused save as saved, and tells the viewer once the retries are used up", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.fetch.mockResolvedValue({ ok: false, status: 500 });
    h.user.current = { id: "a", language: "pl" };
    h.language.current = "pl";
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.choice.current = { language: "en", seq: 1 };
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);

    await vi.advanceTimersByTimeAsync(6_000);
    await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));
    expect(h.fetch).toHaveBeenCalledTimes(3); // first try + two retries
    expect(h.toast.mock.calls[0]![1]).toBe("error");
    expect(h.refreshSession).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("never writes a guest's choice to an account", () => {
    h.user.current = null;
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.choice.current = { language: "pl", seq: 1 };
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.fetch).not.toHaveBeenCalled();
  });
});
