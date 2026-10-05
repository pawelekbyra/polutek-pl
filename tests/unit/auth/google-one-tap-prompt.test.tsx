// @vitest-environment jsdom
/**
 * Google One Tap runs only after the visitor opened the sign-in window (privacy policy § 6): a visitor
 * who just browses never loads Google's script nor gets its g_state cookie. Inside the window the prompt
 * is offered at once, drawn into the dialog when there is no FedCM, and cancelled when the window closes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  oneTap: vi.fn(),
  createAuthClient: vi.fn(),
  oneTapClient: vi.fn(),
  refreshSession: vi.fn(),
  cancel: vi.fn(),
  auth: { isLoaded: true, isSignedIn: false },
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() },
  client: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    twoFactor: { verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => h.router, usePathname: () => "/en", useSearchParams: () => new URLSearchParams() }));
vi.mock("better-auth/react", () => ({ createAuthClient: (...args: unknown[]) => h.createAuthClient(...args) }));
vi.mock("better-auth/client/plugins", () => ({ oneTapClient: (options: unknown) => h.oneTapClient(options) }));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: "gid", turnstileSiteKey: null }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ ...h.auth, signOut: vi.fn() }), refreshSession: h.refreshSession }));
vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: () => undefined }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", tx: txFor("en"), setLanguage: () => {} }) }));

import GoogleOneTapPrompt from "@/app/components/auth/GoogleOneTapPrompt";
import AuthModal from "@/app/components/auth/AuthModal";
import { txFor } from "../i18n/mock-language";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.isLoaded = true;
  h.auth.isSignedIn = false;
  h.oneTap.mockResolvedValue(undefined);
  h.oneTapClient.mockImplementation((options: unknown) => ({ id: "one-tap", options }));
  h.createAuthClient.mockReturnValue({ oneTap: h.oneTap });
  (window as unknown as { google?: unknown }).google = { accounts: { id: { cancel: h.cancel } } };
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { google?: unknown }).google;
});

describe("GoogleOneTapPrompt", () => {
  it("prompts right away and draws the prompt into the given container where FedCM is missing", () => {
    render(<GoogleOneTapPrompt containerId="box" onSignedIn={vi.fn()} />);
    expect(h.oneTap).toHaveBeenCalledTimes(1);
    expect(h.oneTapClient).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "gid",
      autoSelect: false,
      additionalOptions: { prompt_parent_id: "box" },
    }));
  });

  it("finishes the sign-in after a successful tap", async () => {
    const onSignedIn = vi.fn();
    render(<GoogleOneTapPrompt containerId="box" onSignedIn={onSignedIn} />);
    const options = h.oneTap.mock.calls[0][0] as { fetchOptions: { onSuccess: () => void } };
    await act(async () => options.fetchOptions.onSuccess());
    expect(h.refreshSession).toHaveBeenCalledTimes(1);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it("cancels Google's prompt when it unmounts", () => {
    const { unmount } = render(<GoogleOneTapPrompt containerId="box" onSignedIn={vi.fn()} />);
    unmount();
    expect(h.cancel).toHaveBeenCalledTimes(1);
  });

  it("never prompts a signed-in visitor", () => {
    h.auth.isSignedIn = true;
    render(<GoogleOneTapPrompt containerId="box" onSignedIn={vi.fn()} />);
    expect(h.createAuthClient).not.toHaveBeenCalled();
    expect(h.oneTap).not.toHaveBeenCalled();
  });
});

describe("One Tap and the legal notice in the sign-in window", () => {
  it("loads nothing from Google while the window is closed", () => {
    render(<AuthModal open={false} initialView="sign-in" onOpenChange={vi.fn()} />);
    expect(h.createAuthClient).not.toHaveBeenCalled();
    expect(h.oneTap).not.toHaveBeenCalled();
  });

  it("offers One Tap once the window opens, keeps it across sign-in/sign-up and cancels it on close", () => {
    const { rerender } = render(<AuthModal open initialView="sign-in" onOpenChange={vi.fn()} />);
    expect(h.oneTap).toHaveBeenCalledTimes(1);
    expect(document.getElementById("auth-modal-one-tap")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
    expect(h.oneTap).toHaveBeenCalledTimes(1);

    rerender(<AuthModal open={false} initialView="sign-in" onOpenChange={vi.fn()} />);
    expect(h.cancel).toHaveBeenCalled();
  });

  it("shows the Terms and Privacy Policy, in the reader's language and in a new tab, on sign-in and sign-up", () => {
    render(<AuthModal open initialView="sign-in" onOpenChange={vi.fn()} />);
    for (const view of ["sign-in", "sign-up"]) {
      if (view === "sign-up") fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
      const notice = screen.getByTestId("signup-legal-notice");
      expect(notice.textContent, view).toContain("By creating an account (also with Google), you accept:the Terms and the Privacy Policy");
      const terms = screen.getByRole("link", { name: "Terms" });
      const privacy = screen.getByRole("link", { name: "Privacy Policy" });
      expect(terms.getAttribute("href")).toBe("/en/terms");
      expect(privacy.getAttribute("href")).toBe("/en/privacy-policy");
      for (const link of [terms, privacy]) {
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
      }
    }
  });
});
