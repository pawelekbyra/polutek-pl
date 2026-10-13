import { describe, expect, it } from "vitest";
import {
  AUTHZ_ACTIONS,
  CHANNEL_ROLES,
  ROLE_ACTIONS,
  can,
  isPlatformAction,
  roleOf,
  toPrincipal,
  type AuthzAction,
  type ChannelResource,
  type Principal,
} from "@/lib/modules/authz";

const owner: Principal = { kind: "user", userId: "u-owner", onboardingPending: false };
const stranger: Principal = { kind: "user", userId: "u-stranger", onboardingPending: false };
const staff: Principal = { kind: "staff", staffId: "adm-1" };
const system: Principal = { kind: "system", reason: "encode-worker" };
const guest: Principal = { kind: "guest" };

const channel: ChannelResource = { id: "ch-1", ownerUserId: "u-owner", status: "ACTIVE" };

/** `channel.restore` only works on a DELETED channel, so it is tested on its own below. */
const CHANNEL_ACTIONS = AUTHZ_ACTIONS.filter((a) => !isPlatformAction(a) && a !== "channel.create" && a !== "channel.restore");

describe("authz policy: principals", () => {
  it("maps actors to principals (admin becomes staff)", () => {
    expect(toPrincipal({ type: "guest" })).toEqual({ kind: "guest" });
    expect(toPrincipal({ type: "user", userId: "u1" })).toEqual({ kind: "user", userId: "u1", onboardingPending: false });
    expect(toPrincipal({ type: "user", userId: "u1", onboardingPending: true })).toMatchObject({ onboardingPending: true });
    expect(toPrincipal({ type: "admin", userId: "a1" })).toEqual({ kind: "staff", staffId: "a1" });
    expect(toPrincipal({ type: "system", reason: "cron" })).toEqual({ kind: "system", reason: "cron" });
  });

  it("denies a guest everything", () => {
    for (const action of AUTHZ_ACTIONS) {
      expect(can(guest, action, channel)).toEqual({ allow: false, reason: "UNAUTHENTICATED" });
    }
  });

  it("lets the system actor do everything (workers and crons are not reachable by a request)", () => {
    for (const action of AUTHZ_ACTIONS) expect(can(system, action, channel).allow).toBe(true);
  });
});

describe("authz policy: channel membership", () => {
  it("the channel owner can do the owner actions inside their own channel", () => {
    for (const action of ROLE_ACTIONS.OWNER) {
      if (action === "channel.restore") continue;
      expect(can(owner, action, channel).allow, action).toBe(true);
    }
  });

  it("restoring is the owner's alone and only while the channel is DELETED", () => {
    expect(can(owner, "channel.restore", { ...channel, status: "DELETED" }).allow).toBe(true);
    for (const status of ["ACTIVE", "LIMITED", "SUSPENDED", "BANNED", "PENDING_REVIEW"] as const) {
      expect(can(owner, "channel.restore", { ...channel, status }), status).toEqual({ allow: false, reason: "ROLE_FORBIDS" });
    }
    expect(can(stranger, "channel.restore", { ...channel, status: "DELETED" })).toEqual({ allow: false, reason: "NOT_A_MEMBER" });
    const editor: ChannelResource = { id: "ch-2", ownerUserId: "x", members: [{ userId: "u-e", role: "EDITOR" }], status: "DELETED" };
    expect(can({ kind: "user", userId: "u-e", onboardingPending: false }, "channel.restore", editor)).toEqual({ allow: false, reason: "ROLE_FORBIDS" });
  });

  it("a user who is not a member is denied every channel action (BOLA)", () => {
    for (const action of CHANNEL_ACTIONS) {
      expect(can(stranger, action, channel), action).toEqual({ allow: false, reason: "NOT_A_MEMBER" });
    }
  });

  it("an action that needs a channel is denied without one", () => {
    expect(can(owner, "video.update")).toEqual({ allow: false, reason: "RESOURCE_REQUIRED" });
  });

  it("any signed-in user may create a channel, a guest may not", () => {
    expect(can(stranger, "channel.create").allow).toBe(true);
    expect(can(guest, "channel.create").allow).toBe(false);
  });

  it("an account that has not picked a nickname cannot act", () => {
    const pending: Principal = { kind: "user", userId: "u-owner", onboardingPending: true };
    expect(can(pending, "channel.create")).toEqual({ allow: false, reason: "ONBOARDING_PENDING" });
    expect(can(pending, "video.update", channel)).toEqual({ allow: false, reason: "ONBOARDING_PENDING" });
  });

  it("platform actions are staff only", () => {
    for (const action of AUTHZ_ACTIONS.filter(isPlatformAction)) {
      expect(can(owner, action, channel), action).toEqual({ allow: false, reason: "STAFF_ONLY" });
      expect(can(staff, action, channel).allow, action).toBe(true);
    }
  });

  it("explicit memberships win over ownership and give each role exactly its matrix row", () => {
    for (const role of CHANNEL_ROLES) {
      const resource: ChannelResource = { id: "ch-2", ownerUserId: "someone-else", members: [{ userId: "u-m", role }], status: "ACTIVE" };
      const member: Principal = { kind: "user", userId: "u-m", onboardingPending: false };
      for (const action of CHANNEL_ACTIONS) {
        const expected = ROLE_ACTIONS[role].has(action);
        expect(can(member, action, resource).allow, `${role} ${action}`).toBe(expected);
      }
    }
  });

  it("roleOf: member row first, then owner, otherwise none", () => {
    expect(roleOf("u-owner", channel)).toBe("OWNER");
    expect(roleOf("u-stranger", channel)).toBeNull();
    expect(roleOf("u-m", { id: "c", ownerUserId: "u-owner", members: [{ userId: "u-m", role: "EDITOR" }] })).toBe("EDITOR");
  });
});

describe("authz policy: channel status", () => {
  it("a suspended, banned or deleted channel cannot be changed by its own members", () => {
    for (const status of ["SUSPENDED", "BANNED", "DELETED"] as const) {
      const resource: ChannelResource = { ...channel, status };
      for (const action of CHANNEL_ACTIONS) {
        expect(can(owner, action, resource), `${status} ${action}`).toEqual({ allow: false, reason: "CHANNEL_FROZEN" });
      }
    }
  });

  it("a limited channel loses uploads, publishing and payout changes but keeps editing", () => {
    const resource: ChannelResource = { ...channel, status: "LIMITED" };
    for (const action of ["video.create", "video.upload", "video.publish", "payout.manage"] as AuthzAction[]) {
      expect(can(owner, action, resource), action).toEqual({ allow: false, reason: "CHANNEL_LIMITED" });
    }
    expect(can(owner, "video.update", resource).allow).toBe(true);
    expect(can(owner, "comment.moderate", resource).allow).toBe(true);
  });

  it("staff can still act on a frozen channel (that is how it gets unfrozen)", () => {
    expect(can(staff, "platform.suspend_channel", { ...channel, status: "SUSPENDED" }).allow).toBe(true);
    expect(can(staff, "video.delete", { ...channel, status: "SUSPENDED" }).allow).toBe(true);
  });
});

describe("authz policy: staff", () => {
  it("staff cannot change a channel's payout account or its members", () => {
    expect(can(staff, "payout.manage", channel)).toEqual({ allow: false, reason: "STAFF_CANNOT" });
    expect(can(staff, "channel.manage_members", channel)).toEqual({ allow: false, reason: "STAFF_CANNOT" });
  });

  it("staff keeps the legacy ability to reply as the creator until stage 3", () => {
    expect(can(staff, "comment.reply_as_creator", channel).allow).toBe(true);
  });
});

describe("authz matrix contract", () => {
  it("every non-platform action is reachable by at least one role (no dead actions)", () => {
    for (const action of CHANNEL_ACTIONS) {
      const roles = CHANNEL_ROLES.filter((r) => ROLE_ACTIONS[r].has(action));
      expect(roles.length, `no role may do ${action}`).toBeGreaterThan(0);
    }
  });

  it("only the owner can delete the channel, change members or manage payouts", () => {
    for (const action of ["channel.delete", "channel.manage_members", "payout.manage"] as AuthzAction[]) {
      expect(CHANNEL_ROLES.filter((r) => ROLE_ACTIONS[r].has(action))).toEqual(["OWNER"]);
    }
  });

  it("roles are strictly ordered: a lower role never gets an action the owner lacks", () => {
    for (const role of CHANNEL_ROLES) {
      for (const action of ROLE_ACTIONS[role]) expect(ROLE_ACTIONS.OWNER.has(action), `${role} ${action}`).toBe(true);
    }
  });
});
