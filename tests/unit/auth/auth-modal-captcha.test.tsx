// @vitest-environment jsdom
/**
 * The bot check runs in the background: the submit button is visible and active from the start, a
 * click before the Turnstile token exists is queued and sent once the token arrives (with a time
 * limit and "try again"), and every used token is replaced by a fresh one right away.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  client: {
    signIn: { email: vi.fn(), social: vi.fn(), passkey: vi.fn() },
    signUp: { email: vi.fn() },
    passkey: { addPasskey: vi.fn() },
    $fetch: vi.fn(),
    twoFactor: { verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
  },
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => h.router, usePathname: () => "/en", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", tx: txFor("en"), setLanguage: () => {} }) }));
vi.mock("@/lib/auth/client", () => ({
  authClient: h.client,
  captchaFetchOptions: (token: string | null) => (token ? { headers: { "x-captcha-response": token } } : undefined),
}));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: null, turnstileSiteKey: "site-key" }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: false, signOut: vi.fn() }) }));

import AuthModal from "@/app/components/auth/AuthModal";
import { CAPTCHA_WAIT_TIMEOUT_MS } from "@/app/components/auth/useCaptchaGate";
import { txFor } from "../i18n/mock-language";

type Callbacks = Record<string, (...args: unknown[]) => void>;
let widget: Callbacks;
const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

function Modal({ open = true, view = "sign-in" as const }: { open?: boolean; view?: "sign-in" | "sign-up" }) {
  return <AuthModal open={open} initialView={view} onOpenChange={() => undefined} />;
}

const signInButton = () => screen.getByRole("button", { name: /^sign in$/i }) as HTMLButtonElement;

async function openAndFill() {
  const utils = render(<Modal />);
  await waitFor(() => expect(api.render).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.pl" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long password 1" } });
  return utils;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.render.mockImplementation((_el: HTMLElement, opts: Callbacks) => {
    widget = opts;
    return `widget-${api.render.mock.calls.length}`;
  });
  (window as unknown as { turnstile: typeof api }).turnstile = api;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  delete (window as { turnstile?: unknown }).turnstile;
});

describe("AuthModal with Turnstile in the background", () => {
  it("shows an active, labelled submit button right away, before any token exists", async () => {
    await openAndFill();
    expect(signInButton().disabled).toBe(false);
    expect(signInButton().getAttribute("aria-busy")).toBeNull();
    // The check started when the form opened, invisibly.
    expect(screen.getByTestId("turnstile-widget").dataset.visible).toBe("false");
  });

  it("queues a click made before the token and sends it, with the token, once the token arrives", async () => {
    h.client.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await openAndFill();

    fireEvent.click(signInButton());
    expect(h.client.signIn.email).not.toHaveBeenCalled();
    expect(signInButton().disabled).toBe(true);
    expect(signInButton().getAttribute("aria-busy")).toBe("true");
    expect(signInButton().textContent).toContain("Sign in");

    act(() => widget.callback("tok-1"));
    await waitFor(() => expect(h.client.signIn.email).toHaveBeenCalledTimes(1));
    expect(h.client.signIn.email.mock.calls[0][0]).toMatchObject({
      email: "a@b.pl",
      fetchOptions: { headers: { "x-captcha-response": "tok-1" } },
    });
  });

  it("sends straight away when the token is already there", async () => {
    h.client.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await openAndFill();
    act(() => widget.callback("tok-1"));
    fireEvent.click(signInButton());
    await waitFor(() => expect(h.client.signIn.email).toHaveBeenCalledTimes(1));
  });

  it("gives up after the time limit with a readable message, and 'try again' starts a new check", async () => {
    await openAndFill();
    vi.useFakeTimers();
    fireEvent.click(signInButton());
    act(() => vi.advanceTimersByTime(CAPTCHA_WAIT_TIMEOUT_MS));
    vi.useRealTimers();

    expect(screen.getByRole("alert").textContent).toContain("taking too long");
    expect(signInButton().disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
    // The dropped submit does not fire later on its own; the visitor clicks again.
    act(() => widget.callback("late-token"));
    expect(h.client.signIn.email).not.toHaveBeenCalled();
  });

  it("does not time out while the visitor solves an interactive challenge, then sends", async () => {
    h.client.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await openAndFill();
    vi.useFakeTimers();
    fireEvent.click(signInButton());
    act(() => widget["before-interactive-callback"]());
    expect(screen.getByRole("status").textContent).toContain("not a bot");
    act(() => vi.advanceTimersByTime(CAPTCHA_WAIT_TIMEOUT_MS * 3));
    vi.useRealTimers();
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => widget.callback("solved"));
    await waitFor(() => expect(h.client.signIn.email).toHaveBeenCalledTimes(1));
  });

  it("a click after a failed check restarts the check and still sends once it passes", async () => {
    h.client.signIn.email.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await openAndFill();
    act(() => widget["error-callback"]());
    expect(screen.getByRole("alert").textContent).toContain("couldn't complete");

    fireEvent.click(signInButton());
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    act(() => widget.callback("tok-2"));
    await waitFor(() => expect(h.client.signIn.email).toHaveBeenCalledTimes(1));
  });

  it("after a failed sign-in, fetches a fresh token in the background and never reuses the old one", async () => {
    h.client.signIn.email.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    await openAndFill();
    act(() => widget.callback("tok-1"));
    fireEvent.click(signInButton());
    await screen.findByRole("alert");
    expect(api.reset).toHaveBeenCalledWith("widget-1");

    // The used token is gone: the next click waits for the new one.
    fireEvent.click(signInButton());
    expect(h.client.signIn.email).toHaveBeenCalledTimes(1);
    act(() => widget.callback("tok-2"));
    await waitFor(() => expect(h.client.signIn.email).toHaveBeenCalledTimes(2));
    expect(h.client.signIn.email.mock.calls[1][0].fetchOptions).toEqual({ headers: { "x-captcha-response": "tok-2" } });
  });

  it("drops a queued submit when the window closes, so it cannot fire after reopening", async () => {
    const { rerender } = await openAndFill();
    fireEvent.click(signInButton());
    rerender(<Modal open={false} />);
    rerender(<Modal open />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    act(() => widget.callback("tok-new"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.client.signIn.email).not.toHaveBeenCalled();
    expect(signInButton().disabled).toBe(false);
  });

  it("keeps the sign-up button active too (only the password rules disable it)", async () => {
    render(<Modal view="sign-up" />);
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    const button = () => screen.getByRole("button", { name: /^create account$/i }) as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "long password 1" } });
    fireEvent.change(screen.getByLabelText("Repeat password"), { target: { value: "long password 1" } });
    expect(button().disabled).toBe(false);
  });
});

describe("passkey sign-up step with Turnstile in the background", () => {
  beforeEach(() => {
    const PublicKeyCredential = function PublicKeyCredential() {} as unknown as { isConditionalMediationAvailable: () => Promise<boolean> };
    PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
    vi.stubGlobal("PublicKeyCredential", PublicKeyCredential);
    Object.defineProperty(navigator, "credentials", { value: {}, configurable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps 'Create account with a passkey' active, queues an early click and sends it with the token", async () => {
    h.client.signIn.passkey.mockResolvedValue({ data: null, error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", status: 400 } });
    h.client.$fetch.mockResolvedValue({ data: { token: "signed-token" }, error: null });
    h.client.passkey.addPasskey.mockResolvedValue({ data: { id: "pk1" }, error: null });
    render(<Modal />);
    fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
    await screen.findByRole("heading", { name: "Account with a passkey" });
    await waitFor(() => expect(api.render).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "new@example.com" } });

    const button = () => screen.getByRole("button", { name: /^create account with a passkey$/i }) as HTMLButtonElement;
    expect(button().disabled).toBe(false);
    fireEvent.click(button());
    expect(h.client.$fetch).not.toHaveBeenCalled();
    expect(button().getAttribute("aria-busy")).toBe("true");

    const resetsBefore = api.reset.mock.calls.length;
    act(() => widget.callback("tok-pk"));
    await screen.findByRole("heading", { name: "Check your inbox" });
    expect(h.client.$fetch).toHaveBeenCalledWith(
      "/passkey-signup/start",
      expect.objectContaining({ headers: { "x-captcha-response": "tok-pk" } }),
    );
    // The token was used: a fresh one is requested right away.
    expect(api.reset.mock.calls.length).toBeGreaterThan(resetsBefore);
    expect(h.client.passkey.addPasskey).toHaveBeenCalledWith({ name: expect.any(String), context: "signed-token" });
  });
});
