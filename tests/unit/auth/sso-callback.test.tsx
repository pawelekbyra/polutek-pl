// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { sanitizeReturnPath, rememberReturnPath, readReturnPath } from "@/lib/auth/sso-return";

const auth = { isLoaded: false, isSignedIn: false };
const signIn = { status: "needs_identifier", isTransferable: false, finalize: vi.fn() };
const signUp = { status: "missing_requirements", create: vi.fn(), finalize: vi.fn() };
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth,
  useSignIn: () => ({ signIn }),
  useSignUp: () => ({ signUp }),
}));

import SSOCallbackPage from "@/app/sso-callback/page";

describe("sanitizeReturnPath", () => {
  it("keeps same-site paths and rejects open redirects and loops", () => {
    expect(sanitizeReturnPath("/?v=abc")).toBe("/?v=abc");
    expect(sanitizeReturnPath("//evil.com")).toBe("/");
    expect(sanitizeReturnPath("https://evil.com")).toBe("/");
    expect(sanitizeReturnPath("/sso-callback")).toBe("/");
    expect(sanitizeReturnPath(null)).toBe("/");
  });
  it("round-trips through sessionStorage", () => {
    rememberReturnPath("/en/terms");
    expect(readReturnPath()).toBe("/en/terms");
  });
});

describe("/sso-callback page", () => {
  const replace = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockReset();
    auth.isLoaded = false;
    auth.isSignedIn = false;
    signIn.status = "needs_identifier";
    signIn.isTransferable = false;
    signIn.finalize.mockReset().mockResolvedValue({ error: null });
    signUp.status = "missing_requirements";
    signUp.create.mockReset().mockResolvedValue({ error: null });
    signUp.finalize.mockReset().mockResolvedValue({ error: null });
    Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("is never blank: shows a spinner while the handshake runs", () => {
    render(<SSOCallbackPage />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows a way home when Clerk stalls", () => {
    render(<SSOCallbackPage />);
    act(() => {
      vi.advanceTimersByTime(8100);
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/");
  });

  it("redirects immediately when a session already exists", () => {
    auth.isLoaded = true;
    auth.isSignedIn = true;
    rememberReturnPath("/?v=x");
    render(<SSOCallbackPage />);
    expect(replace).toHaveBeenCalledWith("/?v=x");
  });

  it("finalizes a completed sign-in of a returning user", async () => {
    auth.isLoaded = true;
    signIn.status = "complete";
    rememberReturnPath("/?v=y");
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    expect(signIn.finalize).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/?v=y");
  });

  it("turns a transferable sign-in of a new Google user into a sign-up", async () => {
    auth.isLoaded = true;
    signIn.isTransferable = true;
    signUp.status = "complete";
    rememberReturnPath("/?v=z");
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    expect(signUp.create).toHaveBeenCalledWith({ transfer: true });
    expect(signUp.finalize).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/?v=z");
  });
});
