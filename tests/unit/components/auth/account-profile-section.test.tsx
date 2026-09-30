// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const user = {
  firstName: "Stary Nick" as string | null,
  lastName: "" as string | null,
  username: "stary_nick_abc123",
  imageUrl: "/a.png",
  update: vi.fn(),
  setProfileImage: vi.fn(),
  reload: vi.fn(),
};
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/pl",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/components/LanguageContext", () => ({ useLanguage: () => ({ language: "pl", setLanguage: vi.fn() }) }));

import { ProfileSection } from "@/app/components/auth/ProfileSection";

const fetchMock = vi.fn();
const availabilityCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/users/nickname-available"));

function setNickname(value: string) {
  fireEvent.change(screen.getByLabelText("Pseudonim"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
}

describe("account ProfileSection (nickname)", () => {
  beforeEach(() => {
    user.firstName = "Stary Nick";
    user.lastName = "";
    user.update.mockReset().mockResolvedValue(user);
    fetchMock.mockReset().mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.startsWith("/api/users/nickname-available") ? { available: true } : {}), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows one Pseudonim field in the current language and hides the username", () => {
    render(<ProfileSection isPl />);
    expect((screen.getByLabelText("Pseudonim") as HTMLInputElement).value).toBe("Stary Nick");
    expect(screen.queryByLabelText(/nazwa użytkownika/i)).toBeNull();
    expect(screen.queryByLabelText(/^nazwa$/i)).toBeNull();
    expect(screen.queryByDisplayValue("stary_nick_abc123")).toBeNull();
    expect(screen.queryByText("Nickname")).toBeNull();
  });

  it("rejects an invalid nickname with the sign-up messages, without calling Clerk", async () => {
    render(<ProfileSection isPl />);
    setNickname("ab");
    expect((await screen.findByRole("alert")).textContent).toContain("Pseudonim musi mieć co najmniej 3 znaki.");
    setNickname("zły!nick");
    expect((await screen.findByRole("alert")).textContent).toContain("Pseudonim może zawierać tylko litery");
    setNickname("x".repeat(31));
    expect((await screen.findByRole("alert")).textContent).toContain("najwyżej 30 znaków");
    expect(user.update).not.toHaveBeenCalled();
    expect(availabilityCalls()).toHaveLength(0);
  });

  it("blocks a nickname someone else already has", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ available: false, reason: "taken" }), { status: 200 }));
    render(<ProfileSection isPl />);
    setNickname("Zajęty");
    expect((await screen.findByRole("alert")).textContent).toContain("Ten pseudonim jest już zajęty.");
    expect(availabilityCalls()[0][0]).toBe("/api/users/nickname-available?name=Zaj%C4%99ty");
    expect(user.update).not.toHaveBeenCalled();
  });

  it("saves a free nickname as the first name with the last name cleared, and syncs the DB row", async () => {
    render(<ProfileSection isPl />);
    setNickname("  Nowy   Nick ");
    await waitFor(() => expect(user.update).toHaveBeenCalledWith({ firstName: "Nowy Nick", lastName: "" }));
    expect(user.update.mock.calls[0][0]).not.toHaveProperty("username");
    expect(await screen.findByText("Zapisano.")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/user/sync")).toBe(true);
  });

  it("does not report the user's own current name as taken (any letter case)", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ available: false, reason: "taken" }), { status: 200 }));
    render(<ProfileSection isPl />);
    setNickname("STARY NICK");
    await waitFor(() => expect(user.update).toHaveBeenCalledWith({ firstName: "STARY NICK", lastName: "" }));
    expect(availabilityCalls()).toHaveLength(0);
  });

  it("folds a legacy first + last name into one nickname", async () => {
    user.firstName = "Anna";
    user.lastName = "Kowalska";
    render(<ProfileSection isPl />);
    expect((screen.getByLabelText("Pseudonim") as HTMLInputElement).value).toBe("Anna Kowalska");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(user.update).toHaveBeenCalledWith({ firstName: "Anna Kowalska", lastName: "" }));
    expect(availabilityCalls()).toHaveLength(0);
  });

  it("uses English labels and messages when the site is in English", async () => {
    render(<ProfileSection isPl={false} />);
    expect(screen.getByLabelText("Nickname")).toBeTruthy();
    expect(screen.queryByText("Pseudonim")).toBeNull();
    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Nickname must be at least 3 characters.");
  });
});
