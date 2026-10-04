// @vitest-environment jsdom
/** One close button, in the same corner and with the same 44 px target, in every view of the sign-in window. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: () => undefined }));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: null, turnstileSiteKey: null }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: false, signOut: vi.fn() }) }));

import AuthModal from "@/app/components/auth/AuthModal";

function expectOneConsistentCloseButton(title: string) {
  expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: "Close sign-in dialog" });
  expect(buttons).toHaveLength(1);
  const [button] = buttons;
  // Close to the corner, 44 px touch target; the title keeps the same gap on both sides.
  expect(button.className).toMatch(/\bright-1\.5\b/);
  expect(button.className).toMatch(/\btop-1\.5\b/);
  expect(button.className).toMatch(/\bh-11\b/);
  expect(button.className).toMatch(/\bw-11\b/);
  expect(screen.getByRole("heading", { name: title }).parentElement?.className).toMatch(/\bpx-9\b/);
  return button;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign-in window close button", () => {
  it("is the same single button in the sign-in, sign-up and reset views and closes the window", () => {
    const onOpenChange = vi.fn();
    render(<AuthModal open initialView="sign-in" onOpenChange={onOpenChange} />);
    expectOneConsistentCloseButton("Sign in or create account");

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expectOneConsistentCloseButton("Create account");

    fireEvent.click(screen.getByRole("button", { name: /Already have an account/ }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password" }));
    const button = expectOneConsistentCloseButton("Reset password");

    fireEvent.click(button);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is the same on the expired-link view", () => {
    render(<AuthModal open initialView="sign-in" notice="link-expired" onOpenChange={vi.fn()} />);
    expectOneConsistentCloseButton("Link expired");
  });

  it("is the same on the passkey sign-up step (where the long title used to run under it)", async () => {
    const PublicKeyCredential = function PublicKeyCredential() {} as unknown as { isConditionalMediationAvailable: () => Promise<boolean> };
    PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
    vi.stubGlobal("PublicKeyCredential", PublicKeyCredential);
    Object.defineProperty(navigator, "credentials", { value: {}, configurable: true });
    h.client.signIn.passkey.mockResolvedValue({ data: null, error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", status: 400 } });

    render(<AuthModal open initialView="sign-in" onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
    await screen.findByRole("heading", { name: "Account with a passkey" });
    expectOneConsistentCloseButton("Account with a passkey");
  });
});
