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
    render(<SecuritySection isPl={false} />);
    const regenerate = await screen.findByRole("button", { name: /generate new backup codes/i });
    expect((regenerate as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getAllByLabelText("Password")[0], { target: { value: "my password 12345" } });
    fireEvent.click(regenerate);
    await waitFor(() => expect(h.client.twoFactor.generateBackupCodes).toHaveBeenCalledWith({ password: "my password 12345" }));
    expect(await screen.findByText(/aaaa-1111/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  });

  it("shows the server error when the password is wrong", async () => {
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "credential" }] });
    h.client.twoFactor.generateBackupCodes.mockResolvedValue({ data: null, error: { code: "INVALID_PASSWORD", status: 400 } });
    render(<SecuritySection isPl={false} />);
    const regenerate = await screen.findByRole("button", { name: /generate new backup codes/i });
    fireEvent.change(screen.getAllByLabelText("Password")[0], { target: { value: "wrong" } });
    fireEvent.click(regenerate);
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect password.");
  });

  it("explains to Google-only users how to get 2FA", async () => {
    h.twoFactorEnabled = false;
    h.client.listAccounts.mockResolvedValue({ data: [{ providerId: "google" }] });
    render(<SecuritySection isPl={false} />);
    expect(await screen.findByText(/Set a password above/i)).toBeTruthy();
    expect(screen.getByText(/Google account's own protection/i)).toBeTruthy();
  });
});
