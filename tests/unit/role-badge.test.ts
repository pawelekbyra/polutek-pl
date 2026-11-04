import { describe, expect, it } from "vitest";
import { getAuthorBadge } from "@/app/components/comments/types";
import { CREATOR_AVATAR_RING, isRoleBadgeKind, pickRoleBadge, roleRingClass, ROLE_RING_COLOR } from "@/lib/role-badge";
import { roleLabel } from "@/lib/role-label";
import { txFor } from "./i18n/mock-language";

describe("shared role rule (comments and top bar)", () => {
  it("Creator beats VIP beats Base, always exactly one role", () => {
    expect(pickRoleBadge({ isCreator: true, isVip: true, isBase: true })).toBe("AUTHOR");
    expect(pickRoleBadge({ isCreator: false, isVip: true, isBase: true })).toBe("VIP");
    expect(pickRoleBadge({ isCreator: false, isVip: false, isBase: true })).toBe("BASE");
    expect(pickRoleBadge({ isCreator: false, isVip: false, isBase: false })).toBeNull();
  });

  it("the comment section uses the same rule", () => {
    const author = (badges: Array<"ADMIN" | "AUTHOR" | "VIP" | "BASE">) => ({ id: "a", displayName: "A", username: null, imageUrl: null, badges });
    expect(getAuthorBadge(author(["ADMIN", "AUTHOR", "VIP"]))).toBe("AUTHOR");
    expect(getAuthorBadge(author(["VIP"]))).toBe("VIP");
    expect(getAuthorBadge(author(["BASE"]))).toBe("BASE");
    expect(getAuthorBadge(author([]))).toBeNull();
  });

  it("rings share one width and offset and differ only in colour (blue, amber, grey tokens)", () => {
    expect(ROLE_RING_COLOR).toEqual({
      AUTHOR: "ring-[var(--chan-blue)]",
      VIP: "ring-[var(--chan-amber-bright)]",
      BASE: "ring-[var(--chan-muted)]",
    });
    for (const kind of ["AUTHOR", "VIP", "BASE"] as const) {
      expect(roleRingClass(kind)).toContain("ring-2 ring-offset-2 ring-offset-[var(--chan-card)]");
    }
  });

  it("a channel avatar gets the Creator ring: same width, offset and blue as the Creator role ring, border kept", () => {
    expect(CREATOR_AVATAR_RING).toContain("ring-2 ring-offset-2 ring-offset-[var(--chan-card)]");
    expect(CREATOR_AVATAR_RING).toContain(ROLE_RING_COLOR.AUTHOR);
    expect(CREATOR_AVATAR_RING).not.toContain("border-transparent");
    expect(roleRingClass("AUTHOR")).toContain(CREATOR_AVATAR_RING);
  });

  it("validates a role coming from the network", () => {
    expect(isRoleBadgeKind("VIP")).toBe(true);
    expect(isRoleBadgeKind("ADMIN")).toBe(false);
    expect(isRoleBadgeKind(undefined)).toBe(false);
  });

  it("names the roles with the comment badge texts", () => {
    expect(roleLabel("AUTHOR", txFor("pl"))).toBe("Twórca");
    expect(roleLabel("VIP", txFor("pl"))).toBe("Użytkownik VIP");
    expect(roleLabel("BASE", txFor("pl"))).toBe("Normik");
    expect(roleLabel("BASE", txFor("en"))).toBe("Base");
  });
});
