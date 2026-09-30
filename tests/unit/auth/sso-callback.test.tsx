// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { sanitizeReturnPath, rememberReturnPath, readReturnPath } from "@/lib/auth/sso-return";

const auth = { isLoaded: false, isSignedIn: false };
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth,
  AuthenticateWithRedirectCallback: () => <div data-testid="clerk-callback" />,
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
    Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("is never blank: shows a spinner while the handshake runs", () => {
    render(<SSOCallbackPage />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByTestId("clerk-callback")).toBeTruthy();
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
    expect(screen.queryByTestId("clerk-callback")).toBeNull();
  });
});
