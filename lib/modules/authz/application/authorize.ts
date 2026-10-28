import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import type { AuthzAction } from "../domain/actions";
import { can, type DenyReason } from "../domain/policy";
import { toPrincipal } from "../domain/principal";
import type { ChannelResource, ChannelRole, ChannelStatus } from "../domain/resources";

/**
 * What the action is about. Pass the narrowest fact you already have: a `ChannelResource` (no query), a `channelId`,
 * or a `videoId` (the channel is loaded from the video). `null` is for actions that are not about one channel
 * (`channel.create`, `platform.*`).
 */
export type AuthzTarget =
  | { channel: ChannelResource }
  | { channelId: string }
  | { videoId: string }
  | null;

/** The columns the policy needs: owner, lifecycle status and the asking user's own membership (never the whole list). */
function channelFacts(userId: string) {
  return {
    id: true,
    userId: true,
    status: true,
    members: { where: { userId }, select: { userId: true, role: true } },
  } as const;
}

type ChannelRow = {
  id: string;
  userId: string;
  status?: ChannelStatus;
  members?: readonly { userId: string; role: ChannelRole }[];
};

function toResource(row: ChannelRow): ChannelResource {
  return { id: row.id, ownerUserId: row.userId, status: row.status, members: row.members };
}

/**
 * A ready-made `ChannelResource` often carries only owner and status. Without `members` the policy would fall back to
 * "owner or nothing" and wrongly deny a manager, editor or moderator of that channel (audit S18). When the caller
 * did not say anything about members, load the asking user's own membership row. The owner needs no lookup (the
 * fallback already makes them OWNER), and a caller that passes `members` (even empty) is trusted as is.
 */
async function withOwnMembership(ctx: AppContext, channel: ChannelResource, userId: string): Promise<ChannelResource> {
  if (channel.members !== undefined) return channel;
  if (channel.ownerUserId && channel.ownerUserId === userId) return channel;
  const members = await ctx.prisma.channelMember.findMany({
    where: { channelId: channel.id, userId },
    select: { userId: true, role: true },
  });
  return { ...channel, members };
}

/** Loads the channel facts for a target. Only called for ordinary users; staff and system never reach it. */
async function loadChannel(ctx: AppContext, target: AuthzTarget, userId: string): Promise<ChannelResource | null> {
  if (!target) return null;
  const db = ctx.prisma;
  if ("channel" in target) return withOwnMembership(ctx, target.channel, userId);
  const select = channelFacts(userId);
  if ("channelId" in target) {
    const row = await db.creator.findUnique({ where: { id: target.channelId }, select });
    return row ? toResource(row) : null;
  }
  const video = await db.video.findUnique({
    where: { id: target.videoId },
    select: { creator: { select } },
  });
  return video ? toResource(video.creator) : null;
}

const MESSAGES: Record<DenyReason, { status: number; message: string; code: string }> = {
  UNAUTHENTICATED: { status: 401, message: "Zaloguj się, aby wykonać tę akcję.", code: "UNAUTHENTICATED" },
  ONBOARDING_PENDING: { status: 403, message: "Najpierw wybierz nick w oknie pierwszego logowania.", code: "ONBOARDING_PENDING" },
  STAFF_ONLY: { status: 403, message: "Ta akcja jest dostępna tylko dla administratora platformy.", code: "FORBIDDEN" },
  STAFF_CANNOT: { status: 403, message: "Administrator platformy nie może wykonać tej akcji za twórcę.", code: "FORBIDDEN" },
  RESOURCE_REQUIRED: { status: 404, message: "Nie znaleziono zasobu.", code: "NOT_FOUND" },
  NOT_A_MEMBER: { status: 403, message: "Nie masz dostępu do tego kanału.", code: "FORBIDDEN" },
  ROLE_FORBIDS: { status: 403, message: "Twoja rola w tym kanale nie pozwala na tę akcję.", code: "FORBIDDEN" },
  CHANNEL_FROZEN: { status: 403, message: "Ten kanał jest zawieszony, zablokowany albo usunięty.", code: "CHANNEL_FROZEN" },
  CHANNEL_LIMITED: { status: 403, message: "Ten kanał ma ograniczone możliwości (ograniczenie nałożone przez platformę).", code: "CHANNEL_LIMITED" },
};

export function denyError(reason: DenyReason): AppError {
  const m = MESSAGES[reason];
  return new AppError(m.message, m.status, m.code);
}

/**
 * Authorizes `action` for the context's actor. Returns `null` when allowed, or the `AppError` to return/throw
 * (CLAUDE.md 4.23). Call it first in every mutating use case, not in the route.
 */
export async function authorize(ctx: AppContext, action: AuthzAction, target: AuthzTarget = null): Promise<AppError | null> {
  const principal = toPrincipal(ctx.actor);

  // Staff, system and guests never need channel facts: decide without touching the database.
  if (principal.kind !== "user") {
    const decision = can(principal, action);
    return decision.allow ? null : denyError(decision.reason);
  }

  // `channel.create` and platform actions are not about an existing channel.
  const needsChannel = action !== "channel.create" && !action.startsWith("platform.");
  const resource = needsChannel ? await loadChannel(ctx, target, principal.userId) : null;
  if (needsChannel && !resource) return denyError("RESOURCE_REQUIRED");

  const decision = can(principal, action, resource ?? undefined);
  return decision.allow ? null : denyError(decision.reason);
}

/** Throwing form for guards that already use exceptions (`requireVideo`). */
export async function assertAuthorized(ctx: AppContext, action: AuthzAction, target: AuthzTarget = null): Promise<void> {
  const denied = await authorize(ctx, action, target);
  if (denied) throw denied;
}
