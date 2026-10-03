// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReturnPath,
  peekReturnPath,
  rememberReturnPath,
  rememberReturnPathIfNone,
  sanitizeReturnPath,
  withQueryFlag,
} from "@/lib/auth/sso-return";

beforeEach(() => window.sessionStorage.clear());

describe("return path (F-01)", () => {
  it("accepts only same-site relative paths", () => {
    expect(sanitizeReturnPath("/admin?tab=1")).toBe("/admin?tab=1");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined, "/sso-callback?x=1"]) {
      expect(sanitizeReturnPath(bad as string | null | undefined)).toBe("/");
    }
  });

  it("rejects paths that a URL parser would turn into another origin", () => {
    const tab = String.fromCharCode(9);
    const newline = String.fromCharCode(10);
    const carriageReturn = String.fromCharCode(13);
    for (const bad of [
      `/${tab}/evil.example`,
      `/${newline}/evil.example`,
      `/${carriageReturn}/evil.example`,
      `/${tab}${tab}/evil.example/path`,
      "/ /evil.example",
      `/ok${String.fromCharCode(0)}`,
    ]) {
      expect(sanitizeReturnPath(bad)).toBe("/");
    }
    for (const good of ["/admin/videos?edit=1#top", "/pl/watch/film-1", "/en?v=abc&x=%20y", "/a/b//c"]) {
      expect(sanitizeReturnPath(good)).toBe(good);
      expect(new URL(sanitizeReturnPath(good), "https://www.pawelperfect.com").origin).toBe("https://www.pawelperfect.com");
    }
  });

  it("peek ignores a missing or '/' path and never returns an unsafe stored value", () => {
    expect(peekReturnPath()).toBeNull();
    rememberReturnPath("/");
    expect(peekReturnPath()).toBeNull();
    window.sessionStorage.setItem("sso-return-to", "https://evil.example");
    expect(peekReturnPath()).toBeNull();
  });

  it("rememberReturnPathIfNone keeps an existing path and clearReturnPath removes it", () => {
    rememberReturnPathIfNone("/watch/a");
    expect(peekReturnPath()).toBe("/watch/a");
    rememberReturnPathIfNone("/");
    expect(peekReturnPath()).toBe("/watch/a");
    clearReturnPath();
    expect(peekReturnPath()).toBeNull();
  });

  it("withQueryFlag appends to an existing query and keeps the hash", () => {
    expect(withQueryFlag("/pl", "verified", "1")).toBe("/pl?verified=1");
    expect(withQueryFlag("/?v=abc#x", "verified", "1")).toBe("/?v=abc&verified=1#x");
  });
});
