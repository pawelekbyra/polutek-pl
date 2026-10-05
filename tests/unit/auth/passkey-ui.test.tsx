// @vitest-environment jsdom
/** Passkeys in the UI: hidden without WebAuthn, sign-in button + autofill, the account panel list/add/remove. */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  client: {
    signIn: { passkey: vi.fn() },
    passkey: { listUserPasskeys: vi.fn(), addPasskey: vi.fn(), deletePasskey: vi.fn() },
  },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: h.client }));
vi.mock("@/lib/auth/react", () => ({ useUser: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auth/sign-out", () => ({ signOutCompletely: vi.fn() }));

import { PasskeySignIn } from "@/app/components/auth/PasskeySignIn";
import { PasskeysSection } from "@/app/components/auth/PasskeysSection";
import { defaultPasskeyName } from "@/lib/auth/passkey-support";
import { createTx } from "@/lib/i18n/ui";

function enableWebAuthn({ autofill = false } = {}) {
  const PublicKeyCredential = function PublicKeyCredential() {} as unknown as { isConditionalMediationAvailable: () => Promise<boolean> };
  PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(autofill);
  vi.stubGlobal("PublicKeyCredential", PublicKeyCredential);
  Object.defineProperty(navigator, "credentials", { value: {}, configurable: true });
}

function disableWebAuthn() {
  vi.stubGlobal("PublicKeyCredential", undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.client.passkey.listUserPasskeys.mockResolvedValue({ data: [], error: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PasskeySignIn (\"Use a passkey\")", () => {
  function renderButton(props: Partial<React.ComponentProps<typeof PasskeySignIn>> = {}) {
    const handlers = { onSignedIn: vi.fn(), onError: vi.fn(), onNeedAccount: vi.fn() };
    render(<PasskeySignIn active tx={createTx("en")} {...handlers} {...props} />);
    return handlers;
  }

  it("renders nothing and never calls WebAuthn when the browser has no passkey support", async () => {
    disableWebAuthn();
    const { container } = render(<PasskeySignIn active tx={createTx("pl")} onSignedIn={vi.fn()} onError={vi.fn()} onNeedAccount={vi.fn()} />);
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
    expect(h.client.signIn.passkey).not.toHaveBeenCalled();
  });

  it("signs in somebody with an existing passkey", async () => {
    enableWebAuthn();
    h.client.signIn.passkey.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const onSignedIn = vi.fn();
    render(<PasskeySignIn active tx={createTx("pl")} onSignedIn={onSignedIn} onError={vi.fn()} onNeedAccount={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Użyj klucza dostępu" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(h.client.signIn.passkey).toHaveBeenCalledWith();
  });

  it("offers to create an account when the browser had no passkey or nothing was picked", async () => {
    enableWebAuthn();
    h.client.signIn.passkey.mockResolvedValue({ data: null, error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", status: 400 } });
    const handlers = renderButton();
    fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(handlers.onNeedAccount).toHaveBeenCalled());
    expect(handlers.onError).toHaveBeenCalledTimes(1); // only the reset before the attempt
    expect(handlers.onError).toHaveBeenLastCalledWith(null);
  });

  it("never dead-ends on a passkey that belongs to no account: it leads to creating one", async () => {
    enableWebAuthn();
    h.client.signIn.passkey.mockResolvedValue({ data: null, error: { code: "PASSKEY_NOT_FOUND", status: 401 } });
    const handlers = renderButton();
    fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(handlers.onNeedAccount).toHaveBeenCalled());
    expect(handlers.onError).not.toHaveBeenCalledWith(expect.stringMatching(/does not belong/));
  });

  it("tells an account created by passkey to confirm its e-mail first", async () => {
    enableWebAuthn();
    h.client.signIn.passkey.mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    const handlers = renderButton();
    fireEvent.click(await screen.findByRole("button", { name: "Use a passkey" }));
    await waitFor(() => expect(handlers.onError).toHaveBeenLastCalledWith("Please verify your email. We sent a new link."));
    expect(handlers.onNeedAccount).not.toHaveBeenCalled();
  });

  it("offers passkeys in the e-mail autofill when the browser supports it, only while the modal is open", async () => {
    enableWebAuthn({ autofill: true });
    h.client.signIn.passkey.mockReturnValue(new Promise(() => undefined));
    const { rerender } = render(<PasskeySignIn active={false} tx={createTx("pl")} onSignedIn={vi.fn()} onError={vi.fn()} onNeedAccount={vi.fn()} />);
    await screen.findByRole("button");
    expect(h.client.signIn.passkey).not.toHaveBeenCalled();
    rerender(<PasskeySignIn active tx={createTx("pl")} onSignedIn={vi.fn()} onError={vi.fn()} onNeedAccount={vi.fn()} />);
    await waitFor(() => expect(h.client.signIn.passkey).toHaveBeenCalledWith({ autoFill: true }));
  });

  it("stays silent when the autofill request fails on its own or is dismissed", async () => {
    enableWebAuthn({ autofill: true });
    h.client.signIn.passkey.mockResolvedValue({ data: null, error: { status: 429 } });
    const handlers = renderButton();
    await waitFor(() => expect(h.client.signIn.passkey).toHaveBeenCalledWith({ autoFill: true }));
    await Promise.resolve();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(handlers.onNeedAccount).not.toHaveBeenCalled();
  });
});

describe("PasskeysSection (account panel)", () => {
  it("lists the passkeys with their name and date, and hides adding where WebAuthn is missing", async () => {
    disableWebAuthn();
    h.client.passkey.listUserPasskeys.mockResolvedValue({ data: [{ id: "pk1", name: "iPhone · Safari", createdAt: "2026-10-01T10:00:00Z" }], error: null });
    render(<PasskeysSection tx={createTx("en")} />);
    expect(await screen.findByText("iPhone · Safari")).toBeTruthy();
    expect(screen.getByText(/^Added /)).toBeTruthy();
    expect(screen.getByText("This browser does not support passkeys.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a passkey" })).toBeNull();
  });

  it("adds a passkey with the device name and reloads the list", async () => {
    enableWebAuthn();
    h.client.passkey.addPasskey.mockResolvedValue({ data: { id: "pk2" }, error: null });
    render(<PasskeysSection tx={createTx("en")} />);
    expect(await screen.findByText("You have no passkeys yet.")).toBeTruthy();
    const field = screen.getByLabelText("Device name (optional)");
    fireEvent.change(field, { target: { value: "Work laptop" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a passkey" }));
    await waitFor(() => expect(h.client.passkey.addPasskey).toHaveBeenCalledWith({ name: "Work laptop" }));
    expect(await screen.findByText(/Passkey added/)).toBeTruthy();
    expect(h.client.passkey.listUserPasskeys).toHaveBeenCalledTimes(2);
  });

  it("asks to sign in again when the session is not fresh", async () => {
    enableWebAuthn();
    h.client.passkey.addPasskey.mockResolvedValue({ data: null, error: { code: "SESSION_NOT_FRESH", status: 403 } });
    render(<PasskeysSection tx={createTx("pl")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Dodaj klucz dostępu" }));
    expect(await screen.findByRole("button", { name: "Zaloguj się ponownie" })).toBeTruthy();
  });

  it("removes a passkey only after confirmation", async () => {
    disableWebAuthn();
    h.client.passkey.listUserPasskeys.mockResolvedValue({ data: [{ id: "pk1", name: "Mac", createdAt: "2026-10-01T10:00:00Z" }], error: null });
    h.client.passkey.deletePasskey.mockResolvedValue({ data: { status: true }, error: null });
    render(<PasskeysSection tx={createTx("en")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove passkey Mac" }));
    expect(h.client.passkey.deletePasskey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(h.client.passkey.deletePasskey).toHaveBeenCalledWith({ id: "pk1" }));
    expect(await screen.findByText("Passkey removed.")).toBeTruthy();
  });
});

describe("defaultPasskeyName", () => {
  it("names the device and browser from the user agent", () => {
    expect(defaultPasskeyName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("iPhone · Safari");
    expect(defaultPasskeyName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0")).toBe("Windows · Edge");
    expect(defaultPasskeyName("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36")).toBe("Android · Chrome");
    expect(defaultPasskeyName("curl/8")).toBe("Passkey");
  });
});
