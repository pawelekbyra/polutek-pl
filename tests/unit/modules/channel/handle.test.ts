import { describe, expect, it } from "vitest";
import {
  CHANNEL_NAME_MAX_LENGTH,
  HANDLE_MAX_LENGTH,
  RESERVED_HANDLES,
  handleCandidates,
  normalizeHandle,
  suggestHandleBase,
  validateChannelName,
  validateHandle,
} from "@/lib/modules/channel/domain/handle";

describe("validateHandle", () => {
  it("accepts ordinary handles and normalizes case and a leading @", () => {
    expect(validateHandle("pawel.kanal")).toEqual({ ok: true, handle: "pawel.kanal" });
    expect(validateHandle("pawel.tv")).toMatchObject({ ok: false, problem: "LOOKS_LIKE_ADDRESS" });
    expect(validateHandle("@Moj_Kanal-2")).toEqual({ ok: true, handle: "moj_kanal-2" });
    expect(normalizeHandle("  @ABC ")).toBe("abc");
  });

  it("enforces length", () => {
    expect(validateHandle("ab")).toMatchObject({ ok: false, problem: "TOO_SHORT" });
    expect(validateHandle("a".repeat(HANDLE_MAX_LENGTH + 1))).toMatchObject({ ok: false, problem: "TOO_LONG" });
    expect(validateHandle("a".repeat(HANDLE_MAX_LENGTH)).ok).toBe(true);
  });

  it("allows only ASCII lowercase, digits and . _ - (no look-alike letters from other alphabets)", () => {
    for (const bad of ["kanał", "kanal!", "ka nal", "kаnal" /* Cyrillic a */, "канал", "a/b", "a@b"]) {
      expect(validateHandle(bad), bad).toMatchObject({ ok: false, problem: "INVALID_CHARACTERS" });
    }
  });

  it("must start and end with a letter or digit and not repeat separators", () => {
    expect(validateHandle("-abc")).toMatchObject({ ok: false, problem: "EDGE_SEPARATOR" });
    expect(validateHandle("abc_")).toMatchObject({ ok: false, problem: "EDGE_SEPARATOR" });
    expect(validateHandle("a..b")).toMatchObject({ ok: false, problem: "CONSECUTIVE_SEPARATORS" });
    expect(validateHandle("a_-b")).toMatchObject({ ok: false, problem: "CONSECUTIVE_SEPARATORS" });
  });

  it("rejects numbers, phone-like strings and addresses", () => {
    expect(validateHandle("12345678")).toMatchObject({ ok: false, problem: "NOT_A_NAME" });
    expect(validateHandle("500-100-200")).toMatchObject({ ok: false, problem: "NOT_A_NAME" });
    expect(validateHandle("moj.kanal.com")).toMatchObject({ ok: false, problem: "LOOKS_LIKE_ADDRESS" });
    expect(validateHandle("www.kanal")).toMatchObject({ ok: false, problem: "LOOKS_LIKE_ADDRESS" });
  });

  it("rejects routes, staff words and the platform's own name", () => {
    for (const word of ["admin", "studio", "watch", "support", "official", "moderator", "pawelperfect", "polutek", "pomoc"]) {
      expect(validateHandle(word), word).toMatchObject({ ok: false, problem: "RESERVED" });
    }
  });

  it("reserved entries are themselves lowercase and ascii (so the check cannot be bypassed by case)", () => {
    for (const word of RESERVED_HANDLES) expect(word).toBe(word.toLowerCase());
  });
});

describe("handle suggestions", () => {
  it("transliterates Polish letters and separates words", () => {
    expect(suggestHandleBase("Zażółć Gęślą Jaźń")).toBe("zazolc-gesla-jazn");
    expect(suggestHandleBase("  Paweł & Co.  ")).toBe("pawel-co");
  });

  it("produces valid, distinct candidates", () => {
    const candidates = handleCandidates("Mój Kanał");
    expect(candidates.length).toBeGreaterThan(2);
    expect(new Set(candidates).size).toBe(candidates.length);
    for (const c of candidates) expect(validateHandle(c).ok, c).toBe(true);
  });

  it("returns nothing when the base cannot make a valid handle", () => {
    expect(handleCandidates("!!")).toEqual([]);
  });
});

describe("validateChannelName", () => {
  it("trims and collapses whitespace", () => {
    expect(validateChannelName("  Mój   kanał ")).toEqual({ ok: true, name: "Mój kanał" });
  });

  it("rejects empty, too long and invisible characters", () => {
    expect(validateChannelName("   ")).toMatchObject({ ok: false, problem: "EMPTY" });
    expect(validateChannelName("x".repeat(CHANNEL_NAME_MAX_LENGTH + 1))).toMatchObject({ ok: false, problem: "TOO_LONG" });
    expect(validateChannelName("a​b")).toMatchObject({ ok: false, problem: "INVALID_CHARACTERS" });
    expect(validateChannelName("a‮b")).toMatchObject({ ok: false, problem: "INVALID_CHARACTERS" });
    expect(validateChannelName("a\u0007b")).toMatchObject({ ok: false, problem: "INVALID_CHARACTERS" });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(validateChannelName("😀".repeat(CHANNEL_NAME_MAX_LENGTH)).ok).toBe(true);
    expect(validateChannelName("😀".repeat(CHANNEL_NAME_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("keeps the platform's name for staff only", () => {
    expect(validateChannelName("Paweł Perfect TV")).toMatchObject({ ok: false, problem: "RESERVED_BRAND" });
    expect(validateChannelName("Polutek Fan Club")).toMatchObject({ ok: false, problem: "RESERVED_BRAND" });
    expect(validateChannelName("Paweł Perfect", { allowBrand: true }).ok).toBe(true);
  });
});
