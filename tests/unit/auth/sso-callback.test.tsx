// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { sanitizeReturnPath, rememberReturnPath, readReturnPath } from "@/lib/auth/sso-return";

const auth = { isLoaded: false, isSignedIn: false };
const signIn = { status: "needs_identifier", isTransferable: false, finalize: vi.fn() };
const signUp = { status: "missing_requirements", emailAddress: "new@x.pl", firstName: null as string | null, missingFields: [] as string[], unsafeMetadata: {}, create: vi.fn(), update: vi.fn(), finalize: vi.fn() };
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));
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
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ available: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    replace.mockReset();
    auth.isLoaded = false;
    auth.isSignedIn = false;
    signIn.status = "needs_identifier";
    signIn.isTransferable = false;
    signIn.finalize.mockReset().mockResolvedValue({ error: null });
    signUp.status = "missing_requirements";
    signUp.missingFields = [];
    signUp.update.mockReset().mockResolvedValue({ error: null });
    signUp.create.mockReset().mockResolvedValue({ error: null });
    signUp.finalize.mockReset().mockResolvedValue({ error: null });
    Object.defineProperty(window, "location", { value: { ...window.location, replace }, writable: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("shows the first-sign-in form when a new Google user has no username, then finishes", async () => {
    auth.isLoaded = true;
    signIn.isTransferable = true;
    signUp.status = "missing_requirements";
    signUp.missingFields = ["username"];
    signUp.update.mockImplementation(async () => {
      signUp.status = "complete";
      return { error: null };
    });
    rememberReturnPath("/?v=w");
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    expect(signUp.update).not.toHaveBeenCalled();
    // Only the nickname is asked for: no username or first-name fields.
    expect(screen.queryByLabelText(/Username/)).toBeNull();
    expect(screen.queryByLabelText(/First name/)).toBeNull();
    const nicknameInput = screen.getByLabelText(/Nickname/) as HTMLInputElement;
    expect(nicknameInput.value).toBe("");
    await act(async () => {
      fireEvent.change(nicknameInput, { target: { value: "  Żółty   Kot " } });
      fireEvent.click(screen.getByRole("button", { name: /Save and continue/ }));
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/users/nickname-available?name=${encodeURIComponent("Żółty Kot")}`,
      expect.anything(),
    );
    expect(signUp.update).toHaveBeenCalledWith({
      username: expect.stringMatching(/^zolty_kot_[a-z0-9]{6}$/),
      firstName: "Żółty Kot",
      lastName: "",
      unsafeMetadata: { language: "en" },
    });
    const { username } = signUp.update.mock.calls[0][0] as { username: string };
    expect(username).toMatch(/^[a-z0-9_]{4,64}$/);
    expect(signUp.finalize).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/?v=w");
  });

  it("blocks a nickname that is too short without calling Clerk", async () => {
    auth.isLoaded = true;
    signIn.isTransferable = true;
    signUp.missingFields = ["username"];
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Nickname/), { target: { value: "ab" } });
      fireEvent.click(screen.getByRole("button", { name: /Save and continue/ }));
    });
    expect(screen.getByRole("alert").textContent).toMatch(/at least 3/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signUp.update).not.toHaveBeenCalled();
  });

  it("blocks a nickname another user already has", async () => {
    auth.isLoaded = true;
    signIn.isTransferable = true;
    signUp.missingFields = ["username"];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ available: false, reason: "taken" }), { status: 200 }));
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Nickname/), { target: { value: "Paweł Perfect" } });
      fireEvent.click(screen.getByRole("button", { name: /Save and continue/ }));
    });
    expect(screen.getByRole("alert").textContent).toMatch(/already taken/);
    expect(signUp.update).not.toHaveBeenCalled();
  });
});
