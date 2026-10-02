// @vitest-environment jsdom
/**
 * Behaviour gaps found by the 2026-10-02 auth audit (docs/audit/2026-10-02-auth-flows-audit.md).
 *
 * Every `it.fails` below asserts the CORRECT behaviour and currently fails against the app code, so
 * the suite stays green. When a finding is fixed, the matching `it.fails` starts to "pass" and
 * vitest reports it as a failure: change it to a plain `it` in the same PR as the fix.
 * Finding ids (F-xx) refer to the audit document.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => {
  const client = {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    twoFactor: { verifyTotp: vi.fn(), verifyBackupCode: vi.fn(), enable: vi.fn(), disable: vi.fn() },
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    listAccounts: vi.fn(),
    revokeSession: vi.fn(),
    revokeOtherSessions: vi.fn(),
  };
  return { client, router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() } };
});

vi.mock("next/navigation", () => ({ useRouter: () => h.router, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: () => undefined }));
vi.mock("@/lib/auth/public-config", () => ({
  useAuthPublicConfig: () => ({ googleClientId: null, turnstileSiteKey: null }),
}));
vi.mock("@/lib/auth/react", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "u1", twoFactorEnabled: false, primaryEmailAddress: { emailAddress: "a@example.com" }, emailVerified: true },
  }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, signOut: vi.fn() }),
  refreshSession: vi.fn(),
}));

import { authErrorMessage } from "@/lib/auth/errors";
import { SESSION_EXPIRES_IN_SECONDS, SESSION_FRESH_AGE_SECONDS } from "@/lib/auth/config";
import { SSO_RETURN_STORAGE_KEY } from "@/lib/auth/sso-return";
import AuthModal from "@/app/components/auth/AuthModal";
import { SecuritySection } from "@/app/components/auth/SecuritySection";

const GENERIC_EN = "Something went wrong. Please try again.";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("error messages (F-05, F-03)", () => {
  it.fails("F-05: SESSION_NOT_FRESH has its own message instead of the generic one", () => {
    expect(authErrorMessage({ code: "SESSION_NOT_FRESH", status: 403 }, false)).not.toBe(GENERIC_EN);
  });

  it.fails("F-03: TOKEN_EXPIRED (expired e-mail verification link) has its own message", () => {
    expect(authErrorMessage({ code: "TOKEN_EXPIRED" }, false)).not.toBe(GENERIC_EN);
  });
});

describe("session freshness (F-05)", () => {
  it.fails("F-05: the device list / unlink endpoints stay usable for the whole session life", () => {
    // Better Auth's list-sessions and unlink-account require a session younger than freshAge. With
    // freshAge = 1 day and sessions living 30 days, both silently stop working after the first day.
    expect(SESSION_FRESH_AGE_SECONDS).toBeGreaterThanOrEqual(SESSION_EXPIRES_IN_SECONDS);
  });
});

describe("Security tab (F-05)", () => {
  it.fails("F-05: tells the user when the signed-in devices list cannot be loaded", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.listSessions.mockResolvedValue({ data: null, error: { code: "SESSION_NOT_FRESH", status: 403 } });
    h.client.getSession.mockResolvedValue({ data: { session: { token: "t" } } });
    render(<SecuritySection isPl={false} />);
    await screen.findByText("Signed-in devices");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 800 });
  });
});

describe("AuthModal (F-01, F-07)", () => {
  function renderModal() {
    return render(<AuthModal open initialView="sign-in" onOpenChange={() => undefined} />);
  }

  it.fails("F-01: Google sign-in keeps the `next` path the proxy asked us to return to", async () => {
    window.sessionStorage.setItem(SSO_RETURN_STORAGE_KEY, "/admin");
    h.client.signIn.social.mockResolvedValue({ error: null });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(h.client.signIn.social).toHaveBeenCalled());
    // handleOAuth() currently overwrites it with the current location ("/"), so /admin is lost.
    expect(window.sessionStorage.getItem(SSO_RETURN_STORAGE_KEY)).toBe("/admin");
  });

  it.fails("F-01: e-mail sign-in returns the visitor to the remembered `next` path", async () => {
    window.sessionStorage.setItem(SSO_RETURN_STORAGE_KEY, "/admin");
    h.client.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const assign = vi.fn();
    const replace = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { value: { ...original, assign, replace }, writable: true });
    try {
      renderModal();
      fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@example.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
      fireEvent.submit(screen.getByLabelText("Password").closest("form") as HTMLFormElement);
      await waitFor(() => expect(h.client.signIn.email).toHaveBeenCalled());
      await waitFor(() => expect(h.router.refresh).toHaveBeenCalled());
      const navigatedTo = [...assign.mock.calls, ...replace.mock.calls, ...h.router.push.mock.calls, ...h.router.replace.mock.calls].flat();
      expect(navigatedTo).toContain("/admin");
    } finally {
      Object.defineProperty(window, "location", { value: original, writable: true });
    }
  });

  it.fails("F-07: a TOTP code does not silently trust the device for 30 days", async () => {
    h.client.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    h.client.twoFactor.verifyTotp.mockResolvedValue({ data: {}, error: null });
    renderModal();
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
    fireEvent.submit(screen.getByLabelText("Password").closest("form") as HTMLFormElement);
    const code = await screen.findByLabelText("Code");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.submit(code.closest("form") as HTMLFormElement);
    await waitFor(() => expect(h.client.twoFactor.verifyTotp).toHaveBeenCalled());
    // handleTwoFactor() hard-codes trustDevice: true (Better Auth: 30-day cookie that skips 2FA).
    expect(h.client.twoFactor.verifyTotp.mock.calls[0][0]).not.toMatchObject({ trustDevice: true });
  });
});
