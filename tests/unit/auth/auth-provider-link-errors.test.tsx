// @vitest-environment jsdom
/**
 * F-03: the e-mail verification endpoint redirects an
 * expired or invalid link to `<callbackURL>?error=TOKEN_EXPIRED` (or INVALID_TOKEN) and a verified one
 * to `<callbackURL>?verified=1` (our own flag). The provider must turn both into visible feedback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const authState = vi.hoisted(() => ({ isLoaded: true, isSignedIn: false }));

vi.mock("@/app/components/auth/AuthModal", () => ({
  default: ({ open, notice }: { open: boolean; notice?: string | null }) => (
    <div data-testid="auth-modal">{open ? `open:${notice ?? ""}` : "closed"}</div>
  ),
}));
vi.mock("@/app/components/auth/OnboardingDialog", () => ({ default: () => null }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", tx: txFor("en") }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => authState }));

import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";
import { txFor } from "../i18n/mock-language";

function renderAt(url: string) {
  window.history.replaceState(null, "", url);
  return render(
    <AuthModalProvider>
      <div>page</div>
    </AuthModalProvider>,
  );
}

beforeEach(() => {
  authState.isLoaded = true;
  authState.isSignedIn = false;
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("e-mail verification link feedback (F-03)", () => {
  it("opens the modal on the 'link expired' notice for ?error=TOKEN_EXPIRED and tidies the URL", () => {
    renderAt("/pl?error=TOKEN_EXPIRED&v=abc");
    expect(screen.getByTestId("auth-modal").textContent).toBe("open:link-expired");
    expect(window.location.search).toBe("?v=abc");
  });

  it("treats INVALID_TOKEN the same way", () => {
    renderAt("/?error=INVALID_TOKEN");
    expect(screen.getByTestId("auth-modal").textContent).toBe("open:link-expired");
  });

  it("ignores ?error on the reset-password and sso-callback pages, which handle it themselves", () => {
    renderAt("/reset-password?error=INVALID_TOKEN");
    expect(screen.getByTestId("auth-modal").textContent).toBe("closed");
    cleanup();
    renderAt("/sso-callback?error=1");
    expect(screen.getByTestId("auth-modal").textContent).toBe("closed");
  });

  it("ignores unrelated ?error values", () => {
    renderAt("/?error=something-else");
    expect(screen.getByTestId("auth-modal").textContent).toBe("closed");
    expect(window.location.search).toBe("?error=something-else");
  });

  it("shows a confirmation after a verified click when the visitor is signed in", () => {
    authState.isSignedIn = true;
    renderAt("/watch/x?verified=1");
    expect(screen.getByRole("status").textContent).toContain("Email confirmed");
    expect(window.location.search).toBe("");
    expect(screen.getByTestId("auth-modal").textContent).toBe("closed");
  });

  it("asks to sign in after a verified click when there is no session in this browser", () => {
    renderAt("/?verified=1");
    expect(screen.getByTestId("auth-modal").textContent).toBe("open:verified");
  });
});
