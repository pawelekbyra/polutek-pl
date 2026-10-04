import { describe, expect, it } from "vitest";
import { accessTierWhere, parseVideoAccessTier, toVideoAccessTier, VIDEO_ACCESS_TIERS } from "@/lib/access-tier";
import { buildAdminVideoCreatePayload, buildAdminVideoUpdatePayload } from "@/lib/modules/video/application/admin-video-payload";

describe("two video access levels (owner decision 2026-10-04)", () => {
  it("offers exactly PUBLIC and LOGGED_IN", () => {
    expect(VIDEO_ACCESS_TIERS).toEqual(["PUBLIC", "LOGGED_IN"]);
  });

  it.each([
    ["PUBLIC", "PUBLIC"],
    ["LOGGED_IN", "LOGGED_IN"],
    ["PATRON", "LOGGED_IN"],
    ["garbage", "LOGGED_IN"],
    [null, "LOGGED_IN"],
  ])("reads stored %s as %s (unknown fails closed)", (stored, expected) => {
    expect(toVideoAccessTier(stored)).toBe(expected);
  });

  it.each([
    ["PUBLIC", "PUBLIC"],
    ["LOGGED_IN", "LOGGED_IN"],
    ["PATRON", "LOGGED_IN"],
    ["public", null],
    ["", null],
    [42, null],
  ])("accepts %s from the admin as %s", (sent, expected) => {
    expect(parseVideoAccessTier(sent)).toBe(expected);
  });

  it("filters LOGGED_IN as every non-public row, so a leftover PATRON row is listed with it", () => {
    expect(accessTierWhere("PUBLIC")).toBe("PUBLIC");
    expect(accessTierWhere("LOGGED_IN")).toEqual({ not: "PUBLIC" });
    expect(accessTierWhere("PATRON")).toEqual({ not: "PUBLIC" });
    expect(accessTierWhere("ALL")).toBeUndefined();
    expect(accessTierWhere(undefined)).toBeUndefined();
  });

  it("stores what the admin forms send as one of the two levels", () => {
    expect(buildAdminVideoUpdatePayload({ tier: "PATRON" }).tier).toBe("LOGGED_IN");
    expect(buildAdminVideoUpdatePayload({ tier: "nonsense" }).tier).toBeUndefined();
    expect(buildAdminVideoCreatePayload({ title: "a", slug: "a", tier: "PATRON" }).tier).toBe("LOGGED_IN");
    expect(buildAdminVideoCreatePayload({ title: "a", slug: "a" }).tier).toBe("PUBLIC");
  });
});
