/**
 * The one public role of an account, shared by the comment section (pill and ring around the author's avatar) and the
 * top bar (ring around the viewer's own avatar), so the two can never disagree. Exactly one role at a time, most
 * important first: AUTHOR ("Twórca", owns a channel / is the video's creator) > VIP (an active PAID patron-zone access)
 * > BASE ("Normik", every other signed-in account). Tips and donations never produce a role; being an admin is not one.
 */
export type RoleBadgeKind = "AUTHOR" | "VIP" | "BASE";

export function pickRoleBadge(flags: { isCreator: boolean; isVip: boolean; isBase: boolean }): RoleBadgeKind | null {
  if (flags.isCreator) return "AUTHOR";
  if (flags.isVip) return "VIP";
  return flags.isBase ? "BASE" : null;
}

export function isRoleBadgeKind(value: unknown): value is RoleBadgeKind {
  return value === "AUTHOR" || value === "VIP" || value === "BASE";
}

/**
 * Ring colour per role (a decorative box-shadow ring; the role is also named in text). Blue = --chan-blue, amber =
 * --chan-amber-bright, grey = --chan-muted (5.9:1 on white). Whoever draws the ring adds the same width and offset:
 * "border-transparent ring-2 ring-offset-2 ring-offset-[var(--chan-card)]" (ROLE_RING_BASE), so no layout shift.
 */
export const ROLE_RING_COLOR: Record<RoleBadgeKind, string> = {
  AUTHOR: "ring-[var(--chan-blue)]",
  VIP: "ring-[var(--chan-amber-bright)]",
  BASE: "ring-[var(--chan-muted)]",
};
export const ROLE_RING_BASE = "border-transparent ring-2 ring-offset-2 ring-offset-[var(--chan-card)]";

export function roleRingClass(kind: RoleBadgeKind): string {
  return `${ROLE_RING_BASE} ${ROLE_RING_COLOR[kind]}`;
}
