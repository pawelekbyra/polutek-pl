// @vitest-environment jsdom
/** AUTH-04 (shared computers), AUTH-08 (network errors) and AUTH-09 (Google link errors are shown). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  client: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    twoFactor: { verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
  },
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() },
  auth: { isLoaded: true, isSignedIn: false },
  search: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => h.router, usePathname: () => "/en", useSearchParams: () => h.search }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", tx: txFor("en"), setLanguage: () => {} }) }));
vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: () => undefined }));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: null, turnstileSiteKey: null }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ ...h.auth, signOut: vi.fn() }) }));

import AuthModal from "@/app/components/auth/AuthModal";
import SSOCallbackPage from "@/app/sso-callback/page";
import { rememberReturnPath } from "@/lib/auth/sso-return";
import { txFor } from "../i18n/mock-language";

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.isSignedIn = false;
  h.search = new URLSearchParams();
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

function Modal({ open, onOpenChange = () => undefined }: { open: boolean; onOpenChange?: (open: boolean) => void }) {
  return <AuthModal open={open} initialView="sign-in" onOpenChange={onOpenChange} />;
}

describe("AuthModal on a shared computer (AUTH-04)", () => {
  it("forgets the typed e-mail and password once the modal closes", async () => {
    const { rerender } = render(<Modal open />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "first@person.pl" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "first person secret" } });
    rerender(<Modal open={false} />);
    rerender(<Modal open />);
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });

  it("closes (and so wipes the form) after a successful sign-in", async () => {
    h.client.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.pl" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long password 1" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("AuthModal network errors (AUTH-08)", () => {
  it("stops the spinner and shows a readable message when the request throws", async () => {
    h.client.signIn.email.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Modal open />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.pl" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long password 1" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Can't reach the server");
    expect((screen.getByRole("button", { name: /^sign in$/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("/sso-callback with an error (AUTH-09)", () => {
  it("explains a failed Google link to a signed-in user instead of redirecting silently", () => {
    const replace = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });
    rememberReturnPath("/en/account");
    h.auth.isSignedIn = true;
    h.search = new URLSearchParams("error=email_does_not_match");
    render(<SSOCallbackPage />);
    expect(screen.getByRole("alert").textContent).toContain("different email address");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /go back/i }).getAttribute("href")).toBe("/en/account");
  });
});
