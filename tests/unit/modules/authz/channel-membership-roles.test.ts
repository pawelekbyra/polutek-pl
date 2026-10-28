import { describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { authorize } from "@/lib/modules/authz";
import { ROLE_ACTIONS } from "@/lib/modules/authz/domain/matrix";
import { CHANNEL_ROLES, type ChannelRole } from "@/lib/modules/authz/domain/resources";
import type { AuthzAction } from "@/lib/modules/authz";

/**
 * Audit S18: callers that hold a ready-made channel (owner + status, no member list) used to get "owner or nothing".
 * A manager, editor, moderator or translator was refused in their own channel. `authorize({channel})` now loads the
 * asking user's own membership; these tests pin the whole role matrix on an own and a foreign channel.
 */
const OWN = "ch-own";
const FOREIGN = "ch-foreign";
const ACTIONS: AuthzAction[] = ["video.update", "video.preview", "video.publish", "comment.moderate", "video.delete", "channel.delete", "channel.update"];

function ctxFor(actor: Actor, memberships: { channelId: string; userId: string; role: ChannelRole }[]) {
  const channelMember = {
    findMany: vi.fn(async ({ where }: { where: { channelId: string; userId: string } }) =>
      memberships.filter((m) => m.channelId === where.channelId && m.userId === where.userId).map(({ userId, role }) => ({ userId, role })),
    ),
  };
  const ctx = createAppContext({ actor, prisma: { channelMember } as never }) as AppContext;
  return { ctx, channelMember };
}

// What the callers pass: owner and status only, as `MainChannelService` and the comment moderation code do.
const channel = (id: string) => ({ channel: { id, ownerUserId: "someone-else", status: "ACTIVE" as const } });

describe("authorize({channel}) with a channel that carries no member list", () => {
  describe.each(CHANNEL_ROLES.filter((r) => r !== "OWNER"))("role %s in the own channel", (role) => {
    it.each(ACTIONS)("decides %s exactly as the role matrix says", async (action) => {
      const { ctx } = ctxFor({ type: "user", userId: "member" }, [{ channelId: OWN, userId: "member", role }]);
      const denied = await authorize(ctx, action, channel(OWN));
      if (ROLE_ACTIONS[role].has(action)) expect(denied).toBeNull();
      else expect(denied?.statusCode).toBe(403);
    });

    it("gets nothing in a foreign channel where the same account has no membership", async () => {
      const { ctx } = ctxFor({ type: "user", userId: "member" }, [{ channelId: OWN, userId: "member", role }]);
      for (const action of ACTIONS) {
        expect((await authorize(ctx, action, channel(FOREIGN)))?.statusCode).toBe(403);
      }
    });
  });

  it("keeps the owner working without a membership lookup (owner fallback and OWNER row both mean OWNER)", async () => {
    const { ctx, channelMember } = ctxFor({ type: "user", userId: "owner" }, []);
    for (const action of ACTIONS) {
      expect(await authorize(ctx, action, { channel: { id: OWN, ownerUserId: "owner", status: "ACTIVE" } })).toBeNull();
    }
    expect(channelMember.findMany).not.toHaveBeenCalled();
  });

  it("denies a stranger everything", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "stranger" }, [{ channelId: OWN, userId: "member", role: "MANAGER" }]);
    for (const action of ACTIONS) {
      expect((await authorize(ctx, action, channel(OWN)))?.code).toBe("FORBIDDEN");
    }
  });

  it("asks only for the asking user's own row, in the named channel", async () => {
    const { ctx, channelMember } = ctxFor({ type: "user", userId: "member" }, [{ channelId: OWN, userId: "member", role: "MODERATOR" }]);
    await authorize(ctx, "comment.moderate", channel(OWN));
    expect(channelMember.findMany).toHaveBeenCalledTimes(1);
    expect(channelMember.findMany.mock.calls[0][0].where).toEqual({ channelId: OWN, userId: "member" });
  });

  it("trusts a caller that already supplies the members (no second query)", async () => {
    const { ctx, channelMember } = ctxFor({ type: "user", userId: "member" }, [{ channelId: OWN, userId: "member", role: "MANAGER" }]);
    const denied = await authorize(ctx, "video.update", { channel: { id: OWN, ownerUserId: "x", status: "ACTIVE", members: [] } });
    expect(denied?.statusCode).toBe(403);
    expect(channelMember.findMany).not.toHaveBeenCalled();
  });

  it("still freezes a member of a suspended channel and still lets staff and system through untouched", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "member" }, [{ channelId: OWN, userId: "member", role: "MANAGER" }]);
    const frozen = await authorize(ctx, "video.update", { channel: { id: OWN, ownerUserId: "x", status: "SUSPENDED" } });
    expect(frozen?.code).toBe("CHANNEL_FROZEN");
    for (const actor of [{ type: "admin", userId: "adm" } as const, { type: "system", reason: "cron" } as const]) {
      const { ctx: c, channelMember } = ctxFor(actor, []);
      expect(await authorize(c, "video.update", channel(OWN))).toBeNull();
      expect(channelMember.findMany).not.toHaveBeenCalled();
    }
  });
});
