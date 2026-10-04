// @vitest-environment jsdom
/** F-14: the saved language is applied again when a different user signs in during the same page session. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  setLanguage: vi.fn(),
  user: { current: null as null | { id: string; language: string } },
  language: { current: "en" },
  refreshSession: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: vi.fn() }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/app/components/subscriptions/UnsubscribedEmailConsentPrompt", () => ({ default: () => null }));
vi.mock("@/app/components/LanguageContext", () => ({
  useLanguage: () => ({ language: h.language.current, setLanguage: h.setLanguage, isInitialized: true }),
}));
vi.mock("@/lib/auth/react", () => ({
  useUser: () => ({ user: h.user.current, isLoaded: true }),
  refreshSession: h.refreshSession,
}));

import AuthLifecycleProvider from "@/app/components/auth/AuthLifecycleProvider";

beforeEach(() => {
  vi.clearAllMocks();
  h.fetch.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", h.fetch);
  h.language.current = "en";
  h.user.current = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthLifecycleProvider language sync (F-14)", () => {
  it("applies each signed-in user's saved language, also after another user signed out and in", () => {
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

  it("saves a change made after sign-in on the account once, then re-reads the session", async () => {
    h.user.current = { id: "a", language: "pl" };
    h.language.current = "pl";
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.fetch).not.toHaveBeenCalled();

    h.language.current = "en"; // e.g. the navbar switcher or the first-sign-in dialog
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);

    await waitFor(() => expect(h.refreshSession).toHaveBeenCalledTimes(1));
    expect(h.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetch.mock.calls[0]!;
    expect(url).toBe("/api/user/language");
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ language: "en" }) });
  });

  it("does not treat a refused save as saved", async () => {
    h.fetch.mockResolvedValue({ ok: false, status: 400 });
    h.user.current = { id: "a", language: "pl" };
    h.language.current = "pl";
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.language.current = "en";
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);

    await waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.refreshSession).not.toHaveBeenCalled();
  });

  it("never writes a guest's choice to an account", () => {
    h.user.current = null;
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.language.current = "pl";
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.fetch).not.toHaveBeenCalled();
  });
});
