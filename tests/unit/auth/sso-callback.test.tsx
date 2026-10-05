// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { sanitizeReturnPath, rememberReturnPath, readReturnPath } from "@/lib/auth/sso-return";

const auth = { isLoaded: false, isSignedIn: false };
let searchParams = new URLSearchParams();
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en", tx: txFor("en") }) }));
vi.mock("@/lib/auth/react", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));

import SSOCallbackPage from "@/app/sso-callback/page";
import { txFor } from "../i18n/mock-language";

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
    searchParams = new URLSearchParams();
    Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("is never blank: shows a spinner while the session loads", () => {
    render(<SSOCallbackPage />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows a way home when the handshake stalls", () => {
    render(<SSOCallbackPage />);
    act(() => {
      vi.advanceTimersByTime(8100);
    });
    expect(screen.getByRole("alert").textContent).toContain("taking longer");
    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
  });

  it("sends the visitor back to where they started once the session exists", () => {
    rememberReturnPath("/en/watch/clip");
    auth.isLoaded = true;
    auth.isSignedIn = true;
    render(<SSOCallbackPage />);
    expect(replace).toHaveBeenCalledWith("/en/watch/clip");
  });

  it("does not redirect while signed out", () => {
    auth.isLoaded = true;
    render(<SSOCallbackPage />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows an error and a link home when Google sign-in failed", () => {
    searchParams = new URLSearchParams("error=1");
    auth.isLoaded = true;
    render(<SSOCallbackPage />);
    expect(screen.getByRole("alert").textContent).toContain("Google failed");
    expect(screen.getByRole("link", { name: /back to home/i })).toBeTruthy();
  });
});
