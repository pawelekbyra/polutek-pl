// @vitest-environment jsdom
/**
 * F-03 (docs/audit/2026-10-02-auth-flows-audit.md): the e-mail verification endpoint redirects an
 * expired or invalid link to `<callbackURL>?error=TOKEN_EXPIRED` (or INVALID_TOKEN), i.e. to an
 * ordinary page. Nothing on those pages reads `error`, so the visitor lands on the home page with no
 * explanation. This `it.fails` asserts the correct behaviour (some feedback, or the sign-in modal)
 * and must be turned into a plain `it` when the finding is fixed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/app/components/auth/AuthModal", () => ({
  default: ({ open }: { open: boolean }) => <div data-testid="auth-modal">{open ? "open" : "closed"}</div>,
}));
vi.mock("@/app/components/auth/GoogleOneTapPrompt", () => ({ default: () => null }));
vi.mock("@/app/components/auth/OnboardingDialog", () => ({ default: () => null }));

import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("e-mail verification link failure (F-03)", () => {
  it.fails("shows feedback when the verification link redirects with ?error=TOKEN_EXPIRED", () => {
    window.history.replaceState(null, "", "/pl?error=TOKEN_EXPIRED");
    render(
      <AuthModalProvider>
        <div>page</div>
      </AuthModalProvider>,
    );
    const modalOpen = screen.getByTestId("auth-modal").textContent === "open";
    const hasAlert = screen.queryByRole("alert") !== null;
    expect(modalOpen || hasAlert).toBe(true);
  });
});
