// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const user = {
  id: "u1",
  fullName: "Stary Nick" as string | null,
  imageUrl: "/default-avatar.jpg",
};
const refreshSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth/react", () => ({
  useUser: () => ({ user }),
  useAuth: () => ({ signOut: vi.fn() }),
  refreshSession: () => refreshSession(),
}));
vi.mock("@/lib/auth/client", () => ({ authClient: {}, captchaFetchOptions: () => undefined }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/pl",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "pl", tx: txFor("pl"), setLanguage: vi.fn() }) }));

import { ProfileSection } from "@/app/components/auth/ProfileSection";
import { createTx } from "@/lib/i18n/ui";
import { txFor } from "../../i18n/mock-language";

const fetchMock = vi.fn();
const availabilityCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/users/nickname-available"));
const saveCalls = () => fetchMock.mock.calls.filter(([url]) => url === "/api/user/nickname");

function setNickname(value: string) {
  fireEvent.change(screen.getByLabelText("Pseudonim"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
}

describe("account ProfileSection (nickname)", () => {
  beforeEach(() => {
    user.fullName = "Stary Nick";
    refreshSession.mockClear();
    fetchMock.mockReset().mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.startsWith("/api/users/nickname-available") ? { available: true } : {}), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows one Pseudonim field in the current language", () => {
    render(<ProfileSection tx={createTx("pl")} />);
    expect((screen.getByLabelText("Pseudonim") as HTMLInputElement).value).toBe("Stary Nick");
    expect(screen.queryByLabelText(/nazwa użytkownika/i)).toBeNull();
    expect(screen.queryByText("Nickname")).toBeNull();
  });

  it("rejects an invalid nickname with the sign-up messages, without calling the server", async () => {
    render(<ProfileSection tx={createTx("pl")} />);
    setNickname("ab");
    expect((await screen.findByRole("alert")).textContent).toContain("Pseudonim musi mieć co najmniej 3 znaki.");
    setNickname("zły!nick");
    expect((await screen.findByRole("alert")).textContent).toContain("Pseudonim może zawierać tylko litery");
    setNickname("x".repeat(31));
    expect((await screen.findByRole("alert")).textContent).toContain("najwyżej 30 znaków");
    expect(saveCalls()).toHaveLength(0);
    expect(availabilityCalls()).toHaveLength(0);
  });

  it("blocks a nickname someone else already has", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ available: false, reason: "taken" }), { status: 200 }));
    render(<ProfileSection tx={createTx("pl")} />);
    setNickname("Zajęty");
    expect((await screen.findByRole("alert")).textContent).toContain("Ten pseudonim jest już zajęty.");
    expect(availabilityCalls()[0][0]).toBe("/api/users/nickname-available?name=Zaj%C4%99ty");
    expect(saveCalls()).toHaveLength(0);
  });

  it("saves a free nickname through the profile route and refreshes the session", async () => {
    render(<ProfileSection tx={createTx("pl")} />);
    setNickname("  Nowy   Nick ");
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    const [, init] = saveCalls()[0];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ nickname: "Nowy Nick" });
    expect(await screen.findByText("Zapisano.")).toBeTruthy();
    expect(refreshSession).toHaveBeenCalled();
  });

  it("does not report the user's own current name as taken (any letter case)", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.startsWith("/api/users/nickname-available") ? { available: false, reason: "taken" } : {}), { status: 200 }),
    );
    render(<ProfileSection tx={createTx("pl")} />);
    setNickname("STARY NICK");
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    expect(availabilityCalls()).toHaveLength(0);
  });

  it("shows the server's verdict when the save is rejected (race with another user)", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/user/nickname"
        ? new Response(JSON.stringify({ error: "NICKNAME_TAKEN" }), { status: 409 })
        : new Response(JSON.stringify({ available: true }), { status: 200 }),
    );
    render(<ProfileSection tx={createTx("pl")} />);
    setNickname("Wyścig");
    expect((await screen.findByRole("alert")).textContent).toContain("Ten pseudonim jest już zajęty.");
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("uses English labels and messages when the site is in English", async () => {
    render(<ProfileSection tx={createTx("en")} />);
    expect(screen.getByLabelText("Nickname")).toBeTruthy();
    expect(screen.queryByText("Pseudonim")).toBeNull();
    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Nickname must be at least 3 characters.");
  });
});
