import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkNicknameAvailability,
  isSameNickname,
  nicknameCheckMessage,
  nicknameProblemMessage,
  normalizeNickname,
  validateNickname,
} from "@/lib/auth/nickname";
import { createTx } from "@/lib/i18n/ui";

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
      expect(nicknameProblemMessage(reason, createTx("pl"))).toBeTruthy();
      expect(nicknameProblemMessage(reason, createTx("en"))).toBeTruthy();
    }
    expect(nicknameCheckMessage("rate_limited", createTx("en"))).toMatch(/Too many/);
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

describe("isSameNickname", () => {
  it("ignores letter case and extra whitespace", () => {
    expect(isSameNickname(" Stary   Nick", "stary nick")).toBe(true);
    expect(isSameNickname("Łódź", "ŁÓDŹ")).toBe(true);
    expect(isSameNickname("Kot", "Kotek")).toBe(false);
  });
});
