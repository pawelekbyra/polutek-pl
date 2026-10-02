// @vitest-environment jsdom
/** F-14: the saved language is applied again when a different user signs in during the same page session. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const h = vi.hoisted(() => ({
  setLanguage: vi.fn(),
  user: { current: null as null | { id: string; language: string } },
  language: { current: "en" },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: vi.fn() }) }));
vi.mock("@/lib/actions/user", () => ({ updateUserLanguage: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/app/components/subscriptions/UnsubscribedEmailConsentPrompt", () => ({ default: () => null }));
vi.mock("@/app/components/LanguageContext", () => ({
  useLanguage: () => ({ language: h.language.current, setLanguage: h.setLanguage, isInitialized: true }),
}));
vi.mock("@/lib/auth/react", () => ({ useUser: () => ({ user: h.user.current, isLoaded: true }) }));

import AuthLifecycleProvider from "@/app/components/auth/AuthLifecycleProvider";

beforeEach(() => {
  vi.clearAllMocks();
  h.language.current = "en";
  h.user.current = null;
});
afterEach(() => cleanup());

describe("AuthLifecycleProvider language sync (F-14)", () => {
  it("applies each signed-in user's saved language, also after another user signed out and in", () => {
    h.user.current = { id: "a", language: "pl" };
    const view = render(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.setLanguage).toHaveBeenCalledWith("pl", true);

    // sign out, then a different user whose saved language is English signs in while the UI shows Polish
    h.language.current = "pl";
    h.setLanguage.mockClear();
    h.user.current = null;
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    h.user.current = { id: "b", language: "en" };
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    view.rerender(<AuthLifecycleProvider>x</AuthLifecycleProvider>);
    expect(h.setLanguage).toHaveBeenCalledWith("en", true);
  });
});
