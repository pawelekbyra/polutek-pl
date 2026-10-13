import { isPlatformAction, type AuthzAction } from "./actions";
import { FROZEN_STATUSES, LEGACY_STAFF_ALLOWED, LIMITED_DENIED, ROLE_ACTIONS, STAFF_DENIED } from "./matrix";
import type { Principal } from "./principal";
import type { ChannelResource, ChannelRole } from "./resources";

export type DenyReason =
  | "UNAUTHENTICATED"
  | "ONBOARDING_PENDING"
  | "STAFF_ONLY"
  | "STAFF_CANNOT"
  | "RESOURCE_REQUIRED"
  | "NOT_A_MEMBER"
  | "ROLE_FORBIDS"
  | "CHANNEL_FROZEN"
  | "CHANNEL_LIMITED";

export type Decision = { allow: true } | { allow: false; reason: DenyReason };

const ALLOW: Decision = { allow: true };
const deny = (reason: DenyReason): Decision => ({ allow: false, reason });

/** Role of `userId` in the channel: an explicit membership wins, otherwise the channel owner is OWNER. */
export function roleOf(userId: string, resource: ChannelResource): ChannelRole | null {
  const member = resource.members?.find((m) => m.userId === userId);
  if (member) return member.role;
  if (resource.ownerUserId && resource.ownerUserId === userId) return "OWNER";
  return null;
}

/**
 * The single decision function (CLAUDE.md 4.23). Pure: no I/O, no clock. `authorize()` loads the facts and calls this.
 *
 * - system: allowed (workers and crons act as `system`; they are not reachable by a request).
 * - guest: denied.
 * - staff: platform actions and every channel action, except those in `STAFF_DENIED`.
 * - user: only inside a channel where the role's matrix row contains the action, and the channel status allows it.
 */
export function can(principal: Principal, action: AuthzAction, resource?: ChannelResource): Decision {
  if (principal.kind === "system") return ALLOW;
  if (principal.kind === "guest") return deny("UNAUTHENTICATED");

  if (principal.kind === "staff") {
    if (STAFF_DENIED.has(action) && !LEGACY_STAFF_ALLOWED.has(action)) return deny("STAFF_CANNOT");
    return ALLOW;
  }

  // principal.kind === "user"
  if (isPlatformAction(action)) return deny("STAFF_ONLY");
  if (principal.onboardingPending) return deny("ONBOARDING_PENDING");

  if (action === "channel.create") return ALLOW;
  if (!resource) return deny("RESOURCE_REQUIRED");

  const role = roleOf(principal.userId, resource);
  if (!role) return deny("NOT_A_MEMBER");
  if (!ROLE_ACTIONS[role].has(action)) return deny("ROLE_FORBIDS");

  // A channel its owner deleted can be restored by that owner during the grace period; nothing else is open.
  if (action === "channel.restore") {
    return resource.status === "DELETED" ? ALLOW : deny("ROLE_FORBIDS");
  }
  if (resource.status && FROZEN_STATUSES.has(resource.status)) return deny("CHANNEL_FROZEN");
  if (resource.status === "LIMITED" && LIMITED_DENIED.has(action)) return deny("CHANNEL_LIMITED");

  return ALLOW;
}
