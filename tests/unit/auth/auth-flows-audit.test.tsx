// @vitest-environment jsdom
/**
 * Behaviour gaps found by the 2026-10-02 auth audit.
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

vi.mock("next/navigation", () => ({ useRouter: () => h.router, usePathname: () => "/en", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", tx: txFor("en"), setLanguage: () => {} }) }));
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
import { SSO_RETURN_STORAGE_KEY } from "@/lib/auth/sso-return";
import AuthModal from "@/app/components/auth/AuthModal";
import { SecuritySection } from "@/app/components/auth/SecuritySection";
import { createTx } from "@/lib/i18n/ui";
import { txFor } from "../i18n/mock-language";

const GENERIC_EN = "Something went wrong. Please try again.";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("error messages (F-05, F-03)", () => {
  it("F-05: SESSION_NOT_FRESH has its own message instead of the generic one", () => {
    expect(authErrorMessage({ code: "SESSION_NOT_FRESH", status: 403 }, createTx("en"))).not.toBe(GENERIC_EN);
  });

  it("F-03: TOKEN_EXPIRED (expired e-mail verification link) has its own message", () => {
    expect(authErrorMessage({ code: "TOKEN_EXPIRED" }, createTx("en"))).not.toBe(GENERIC_EN);
  });
});

describe("Security tab (F-05)", () => {
  // freshAge stays at 1 day on purpose (sensitive endpoints keep their check); an older session must be
  // told to sign in again instead of seeing an empty list.
  it("F-05: a stale session gets a clear 'sign in again' prompt instead of an empty device list", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.listSessions.mockResolvedValue({ data: null, error: { code: "SESSION_NOT_FRESH", status: 403 } });
    h.client.getSession.mockResolvedValue({ data: { session: { token: "t" } } });
    render(<SecuritySection tx={createTx("en")} />);
    await screen.findByText("Signed-in devices");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("sign in again");
    expect(screen.getByRole("button", { name: /sign in again/i })).toBeTruthy();
  });

  it("F-05: other list errors show the generic message", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.listSessions.mockResolvedValue({ data: null, error: { code: "BOOM", status: 500 } });
    h.client.getSession.mockResolvedValue({ data: { session: { token: "t" } } });
    render(<SecuritySection tx={createTx("en")} />);
    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_EN);
  });
});

describe("AuthModal (F-01, F-07)", () => {
  function renderModal() {
    return render(<AuthModal open initialView="sign-in" onOpenChange={() => undefined} />);
  }

  it("has no language picker on sign-in or sign-up (the site language is used; the first-sign-in dialog asks)", () => {
    const { unmount } = render(<AuthModal open initialView="sign-in" onOpenChange={() => undefined} />);
    expect(screen.queryByText("Language:")).toBeNull();
    unmount();
    render(<AuthModal open initialView="sign-up" onOpenChange={() => undefined} />);
    expect(screen.queryByText("Language:")).toBeNull();
  });

  it("F-01: Google sign-in keeps the `next` path the proxy asked us to return to", async () => {
    window.sessionStorage.setItem(SSO_RETURN_STORAGE_KEY, "/admin");
    h.client.signIn.social.mockResolvedValue({ error: null });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(h.client.signIn.social).toHaveBeenCalled());
    expect(window.sessionStorage.getItem(SSO_RETURN_STORAGE_KEY)).toBe("/admin");
  });

  it("F-01: e-mail sign-in returns the visitor to the remembered `next` path", async () => {
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

  async function reachTwoFactorStep() {
    h.client.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    h.client.twoFactor.verifyTotp.mockResolvedValue({ data: {}, error: null });
    renderModal();
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
    fireEvent.submit(screen.getByLabelText("Password").closest("form") as HTMLFormElement);
    const code = await screen.findByLabelText("Code");
    fireEvent.change(code, { target: { value: "123456" } });
    return code;
  }

  it("F-07: a TOTP code does not silently trust the device (opt-in, off by default)", async () => {
    const code = await reachTwoFactorStep();
    fireEvent.submit(code.closest("form") as HTMLFormElement);
    await waitFor(() => expect(h.client.twoFactor.verifyTotp).toHaveBeenCalled());
    expect(h.client.twoFactor.verifyTotp.mock.calls[0][0]).toMatchObject({ trustDevice: false });
  });

  it("F-07: ticking 'Remember this device' sends trustDevice", async () => {
    const code = await reachTwoFactorStep();
    fireEvent.click(screen.getByLabelText(/remember this device/i));
    fireEvent.submit(code.closest("form") as HTMLFormElement);
    await waitFor(() => expect(h.client.twoFactor.verifyTotp).toHaveBeenCalled());
    expect(h.client.twoFactor.verifyTotp.mock.calls[0][0]).toMatchObject({ trustDevice: true });
  });

  it("F-09: a wrong e-mail/password hints at Google and 'Forgot password' for older accounts", async () => {
    h.client.signIn.email.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    renderModal();
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "old@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "whatever password" } });
    fireEvent.submit(screen.getByLabelText("Password").closest("form") as HTMLFormElement);
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect email or password.");
    expect(screen.getByText(/older account/i).textContent).toMatch(/Google/);
    expect(screen.getByText(/older account/i).textContent).toMatch(/Forgot password/);
  });
});
