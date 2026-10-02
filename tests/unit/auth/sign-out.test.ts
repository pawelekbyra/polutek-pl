// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: h.signOut } }));

import { signOutCompletely } from "@/lib/auth/sign-out";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  delete (window as unknown as { google?: unknown }).google;
});

describe("signOutCompletely (shared computers)", () => {
  it("ends the session, disables Google auto-select and forgets the return path", async () => {
    const disableAutoSelect = vi.fn();
    (window as unknown as { google: unknown }).google = { accounts: { id: { disableAutoSelect } } };
    window.sessionStorage.setItem("sso-return-to", "/admin");
    h.signOut.mockResolvedValue({});
    await signOutCompletely();
    expect(h.signOut).toHaveBeenCalled();
    expect(disableAutoSelect).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("sso-return-to")).toBeNull();
  });

  it("still cleans up when the sign-out request fails, and works without Google's script", async () => {
    h.signOut.mockRejectedValue(new Error("offline"));
    window.sessionStorage.setItem("sso-return-to", "/admin");
    await expect(signOutCompletely()).rejects.toThrow("offline");
    expect(window.sessionStorage.getItem("sso-return-to")).toBeNull();
  });
});
