// @vitest-environment jsdom
/** F-08: backup codes can be regenerated (password re-entered) and copied/downloaded; Google-only users get an explanation. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  client: {
    listAccounts: vi.fn(),
    listSessions: vi.fn(),
    getSession: vi.fn(),
    twoFactor: { generateBackupCodes: vi.fn(), enable: vi.fn(), disable: vi.fn(), verifyTotp: vi.fn() },
    changePassword: vi.fn(),
    requestPasswordReset: vi.fn(),
  },
  twoFactorEnabled: true,
}));

vi.mock("@/lib/auth/client", () => ({ authClient: h.client, captchaFetchOptions: () => undefined }));
vi.mock("@/lib/auth/public-config", () => ({ useAuthPublicConfig: () => ({ googleClientId: null, turnstileSiteKey: null }) }));
vi.mock("@/lib/auth/react", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "u1", twoFactorEnabled: h.twoFactorEnabled, primaryEmailAddress: { emailAddress: "a@example.com" } },
  }),
  refreshSession: vi.fn(),
}));

import { SecuritySection } from "@/app/components/auth/SecuritySection";
import { createTx } from "@/lib/i18n/ui";

beforeEach(() => {
  vi.clearAllMocks();
  h.twoFactorEnabled = true;
  h.client.listSessions.mockResolvedValue({ data: [] });
  h.client.getSession.mockResolvedValue({ data: { session: { token: "t" } } });
});
afterEach(() => cleanup());

describe("2FA backup codes (F-08)", () => {
  it("regenerates backup codes after the password is entered and shows copy/download", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.twoFactor.generateBackupCodes.mockResolvedValue({ data: { backupCodes: ["aaaa-1111", "bbbb-2222"] }, error: null });
    render(<SecuritySection tx={createTx("en")} />);
    const regenerate = await screen.findByRole("button", { name: /generate new backup codes/i });
    fireEvent.change(screen.getByLabelText("Password for new backup codes"), { target: { value: "my password 12345" } });
    fireEvent.click(regenerate);
    await waitFor(() => expect(h.client.twoFactor.generateBackupCodes).toHaveBeenCalledWith({ password: "my password 12345" }));
    expect(await screen.findByText(/aaaa-1111/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  });

  it("shows the server error when the password is wrong", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.twoFactor.generateBackupCodes.mockResolvedValue({ data: null, error: { code: "INVALID_PASSWORD", status: 400 } });
    render(<SecuritySection tx={createTx("en")} />);
    const regenerate = await screen.findByRole("button", { name: /generate new backup codes/i });
    fireEvent.change(screen.getByLabelText("Password for new backup codes"), { target: { value: "wrong" } });
    fireEvent.click(regenerate);
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect password.");
  });

  it("never turns 2FA off when the backup-code password is submitted with Enter (AUTH-13)", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.twoFactor.generateBackupCodes.mockResolvedValue({ data: { backupCodes: ["cccc-3333"] }, error: null });
    render(<SecuritySection tx={createTx("en")} />);
    const field = await screen.findByLabelText("Password for new backup codes");
    fireEvent.change(field, { target: { value: "my password 12345" } });
    fireEvent.submit(field.closest("form")!);
    await waitFor(() => expect(h.client.twoFactor.generateBackupCodes).toHaveBeenCalled());
    expect(h.client.twoFactor.disable).not.toHaveBeenCalled();
    // Turning off has its own password field and button, disabled until that field is filled.
    const off = screen.getByRole("button", { name: /turn off two-step verification/i }) as HTMLButtonElement;
    expect(off.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Password to turn verification off"), { target: { value: "pw for off 12345" } });
    h.client.twoFactor.disable.mockResolvedValue({ error: null });
    fireEvent.click(off);
    await waitFor(() => expect(h.client.twoFactor.disable).toHaveBeenCalledWith({ password: "pw for off 12345" }));
  });

  it("stops the spinner and says so when the connection drops (AUTH-08)", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.twoFactor.generateBackupCodes.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SecuritySection tx={createTx("en")} />);
    const field = await screen.findByLabelText("Password for new backup codes");
    fireEvent.change(field, { target: { value: "my password 12345" } });
    fireEvent.click(screen.getByRole("button", { name: /generate new backup codes/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Can't reach the server");
    expect((screen.getByRole("button", { name: /generate new backup codes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains to Google-only users how to get 2FA", async () => {
    h.twoFactorEnabled = false;
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "google" }] });
    render(<SecuritySection tx={createTx("en")} />);
    expect(await screen.findByText(/Set a password above/i)).toBeTruthy();
    expect(screen.getByText(/Google account's own protection/i)).toBeTruthy();
  });
});
