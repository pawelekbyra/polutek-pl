import { describe, expect, it } from "vitest";
import { handlePathRewrite, parseHandlePath } from "@/lib/channel-handle-path";

describe("/@handle paths", () => {
  it("rewrites bare and prefixed handle paths to the channel page", () => {
    expect(handlePathRewrite("/@pawel.kanal")).toBe("/pl/channel/pawel.kanal");
    expect(handlePathRewrite("/en/@pawel")).toBe("/en/channel/pawel");
    expect(handlePathRewrite("/de/@Some_Name-1/")).toBe("/de/channel/Some_Name-1");
  });

  it("ignores everything that is not a handle path", () => {
    for (const p of ["/", "/channel/pawel", "/@", "/@ab", "/@" + "a".repeat(31), "/@a b", "/xx/@pawel", "/pl/@pawel/extra", "/@pawel@x", "/api/@pawel"]) {
      expect(parseHandlePath(p)).toBeNull();
    }
  });

  it("never lets a handle smuggle a path separator or an encoded dot segment", () => {
    expect(parseHandlePath("/@..")).toBeNull();
    expect(parseHandlePath("/@a/../b")).toBeNull();
    expect(handlePathRewrite("/@%2e%2e%2f")).toBeNull();
  });
});
