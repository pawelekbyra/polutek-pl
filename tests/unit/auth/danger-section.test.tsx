// @vitest-environment jsdom
/** F-12 (UI): account deletion asks for the password, or sends Google-only users through Google again. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  client: { listAccounts: vi.fn(), signOut: vi.fn(), signIn: { social: vi.fn() } },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: () => undefined }));
vi.mock("@/lib/auth/react", () => ({ useUser: () => ({ user: { id: "u1" } }) }));

import { DangerSection } from "@/app/components/auth/AccountSections";
import { createTx } from "@/lib/i18n/ui";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  h.client.signOut.mockResolvedValue({});
  h.client.signIn.social.mockResolvedValue({ error: null });
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DangerSection (F-12)", () => {
  it("sends the password with the delete request and keeps the button disabled without it", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "INVALID_PASSWORD" }) });
    render(<DangerSection tx={createTx("en")} onDeleted={() => undefined} />);
    const submit = await screen.findByRole("button", { name: /delete account permanently/i });
    fireEvent.change(screen.getByLabelText(/type delete/i), { target: { value: "DELETE" } });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: "hunter2 hunter2" } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/user/account");
    expect(JSON.parse(init.body)).toEqual({ password: "hunter2 hunter2" });
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect password.");
  });

  it("offers 'Confirm with Google' when the server wants a recent sign-in", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "google" }] });
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "REAUTH_REQUIRED" }) });
    render(<DangerSection tx={createTx("en")} onDeleted={() => undefined} />);
    const submit = await screen.findByRole("button", { name: /delete account permanently/i });
    expect(screen.queryByLabelText(/your password/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/type delete/i), { target: { value: "DELETE" } });
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(submit);
    const google = await screen.findByRole("button", { name: /confirm with google/i });
    fireEvent.click(google);
    await waitFor(() => expect(h.client.signIn.social).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" })));
  });

  it("signs out and reloads after a successful deletion", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    const onDeleted = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { value: { ...original, assign: vi.fn() }, writable: true });
    try {
      render(<DangerSection tx={createTx("en")} onDeleted={onDeleted} />);
      const submit = await screen.findByRole("button", { name: /delete account permanently/i });
      fireEvent.change(screen.getByLabelText(/type delete/i), { target: { value: "DELETE" } });
      fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: "right password 1" } });
      fireEvent.click(submit);
      await waitFor(() => expect(onDeleted).toHaveBeenCalled());
      expect(h.client.signOut).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { value: original, writable: true });
    }
  });
});
