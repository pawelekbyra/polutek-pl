import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkNicknameAvailability,
  nicknameCheckMessage,
  nicknameProblemMessage,
  normalizeNickname,
  validateNickname,
} from "@/lib/auth/nickname";
import { isValidUsername, usernameFromNickname } from "@/lib/auth/generate-username";

describe("validateNickname", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeNickname("  Jan   Kowalski \t")).toBe("Jan Kowalski");
    expect(validateNickname("  Jan   Kowalski ")).toEqual({ ok: true, value: "Jan Kowalski" });
  });

  it("accepts several words, Polish letters, digits and - _ .", () => {
    for (const ok of ["Żółta Łódź", "kot_99", "a.b-c", "Paweł Perfect", "abc"]) {
      expect(validateNickname(ok).ok).toBe(true);
    }
  });

  it("rejects too short and too long nicknames (after trimming)", () => {
    expect(validateNickname("  ab  ")).toEqual({ ok: false, reason: "too_short" });
    expect(validateNickname("a".repeat(31))).toEqual({ ok: false, reason: "too_long" });
    expect(validateNickname("a".repeat(30)).ok).toBe(true);
  });

  it("rejects characters outside the allowed set", () => {
    for (const bad of ["kot@dom", "<script>", "hej!", "emoji 😀", "a/b"]) {
      expect(validateNickname(bad)).toEqual({ ok: false, reason: "invalid_chars" });
    }
  });

  it("has a message for every problem in both languages", () => {
    for (const reason of ["too_short", "too_long", "invalid_chars", "taken"] as const) {
      expect(nicknameProblemMessage(reason, true)).toBeTruthy();
      expect(nicknameProblemMessage(reason, false)).toBeTruthy();
    }
    expect(nicknameCheckMessage("rate_limited", false)).toMatch(/Too many/);
  });
});

describe("usernameFromNickname", () => {
  it("derives a valid hidden Clerk username", () => {
    const cases = ["Żółty Kot", "Łukasz", "a", "!!!", "x".repeat(40), "Jan Kowalski-Nowak.pl"];
    for (const nick of cases) {
      const username = usernameFromNickname(nick);
      expect(isValidUsername(username)).toBe(true);
    }
    expect(usernameFromNickname("Żółty Kot")).toMatch(/^zolty_kot_[a-z0-9]{6}$/);
    expect(usernameFromNickname("Łukasz")).toMatch(/^lukasz_/);
    expect(usernameFromNickname("x".repeat(40)).split("_")[0]).toHaveLength(20);
  });
});

describe("checkNicknameAvailability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports taken, rate limits, and fails open on errors", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ available: false, reason: "taken" })));
    expect(await checkNicknameAvailability("Kot")).toEqual({ available: false, reason: "taken" });

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    expect(await checkNicknameAvailability("Kot")).toEqual({ available: false, reason: "rate_limited" });

    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect(await checkNicknameAvailability("Kot")).toEqual({ available: true });

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await checkNicknameAvailability("Kot")).toEqual({ available: true });
  });
});
