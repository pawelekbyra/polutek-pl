// @vitest-environment jsdom
/** "Sign in or create account": Use a passkey signs in, or creates an account with a new passkey. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  client: {
    signIn: { email: vi.fn(), social: vi.fn(), passkey: vi.fn() },
    signUp: { email: vi.fn() },
    passkey: { addPasskey: vi.fn() },
    twoFactor: { verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    $fetch: vi.fn(),
  },
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => h.router, usePathname: () => "/en", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", setLanguage: () => {} }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: (token: string | null) => (token ? { headers: { "x-captcha-response": token } } : undefined) }));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: null, turnstileSiteKey: null }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: false, signOut: vi.fn() }) }));

import AuthModal from "@/app/components/auth/AuthModal";

function enableWebAuthn() {
  const PublicKeyCredential = function PublicKeyCredential() {} as unknown as { isConditionalMediationAvailable: () => Promise<boolean> };
  PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
  vi.stubGlobal("PublicKeyCredential", PublicKeyCredential);
  Object.defineProperty(navigator, "credentials", { value: {}, configurable: true });
}

function renderModal(onOpenChange = vi.fn()) {
  render(<AuthModal open initialView="sign-in" onOpenChange={onOpenChange} />);
  return onOpenChange;
}

async function openPasskeySignup() {
  h.client.signIn.passkey.mockResolvedValue({ data: null, error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", status: 400 } });
  fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
  await screen.findByRole("heading", { name: "Account with a passkey" });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "new@example.com" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  enableWebAuthn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign-in window copy (owner decision 2026-10-04)", () => {
  it("is titled 'Sign in or create account' and says new visitors get an account automatically", async () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Sign in or create account" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Use a passkey" })).toBeTruthy();
    expect(screen.getByText("New here? We'll create your account automatically.")).toBeTruthy();
    expect(screen.getByText("Don't have an account?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("heading", { name: "Create account" })).toBeTruthy();
  });
});

describe("Use a passkey", () => {
  it("signs in an existing passkey user and closes the window (no TOTP step)", async () => {
    h.client.signIn.passkey.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const onOpenChange = renderModal();
    fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("heading", { name: "Two-step verification" })).toBeNull();
  });

  it("without a passkey: asks for the e-mail, creates the passkey with the sign-up token and asks to confirm the e-mail", async () => {
    h.client.$fetch.mockResolvedValue({ data: { token: "signed-token" }, error: null });
    h.client.passkey.addPasskey.mockResolvedValue({ data: { id: "pk1" }, error: null });
    renderModal();
    await openPasskeySignup();
    fireEvent.click(screen.getByRole("button", { name: "Create account with a passkey" }));
    await screen.findByRole("heading", { name: "Check your inbox" });
    expect(h.client.$fetch).toHaveBeenCalledWith(
      "/passkey-signup/start",
      expect.objectContaining({ method: "POST", body: expect.objectContaining({ email: "new@example.com", language: "en" }) }),
    );
    expect(h.client.passkey.addPasskey).toHaveBeenCalledWith({ name: expect.any(String), context: "signed-token" });
    expect(screen.getByText(/Passkey saved\. Confirm your email/)).toBeTruthy();
  });

  it("an address that already has an account gets the same answer as the e-mail sign-up, and no passkey is created", async () => {
    h.client.$fetch.mockResolvedValue({ data: null, error: { code: "EMAIL_TAKEN", status: 422 } });
    renderModal();
    await openPasskeySignup();
    fireEvent.click(screen.getByRole("button", { name: "Create account with a passkey" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This email already has an account.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Forgot password" })).toBeTruthy();
    expect(h.client.passkey.addPasskey).not.toHaveBeenCalled();
  });

  it("closing the browser's passkey prompt during sign-up leaves the person on the step with a hint", async () => {
    h.client.$fetch.mockResolvedValue({ data: { token: "signed-token" }, error: null });
    h.client.passkey.addPasskey.mockResolvedValue({ data: null, error: { code: "ERROR_CEREMONY_ABORTED", status: 400 } });
    renderModal();
    await openPasskeySignup();
    fireEvent.click(screen.getByRole("button", { name: "Create account with a passkey" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/No passkey was created/);
    expect(screen.getByRole("heading", { name: "Account with a passkey" })).toBeTruthy();
  });

  it("explains the rate limit on the sign-up step", async () => {
    h.client.$fetch.mockResolvedValue({ data: null, error: { status: 429 } });
    renderModal();
    await openPasskeySignup();
    fireEvent.click(screen.getByRole("button", { name: "Create account with a passkey" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many requests/);
  });
});
