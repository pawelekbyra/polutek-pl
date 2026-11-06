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
export const ROLE_RING_SPACING = "ring-2 ring-offset-2 ring-offset-[var(--chan-card)]";
export const ROLE_RING_BASE = `border-transparent ${ROLE_RING_SPACING}`;

export function roleRingClass(kind: RoleBadgeKind): string {
  return `${ROLE_RING_BASE} ${ROLE_RING_COLOR[kind]}`;
}

/**
 * Ring of a CHANNEL / CREATOR avatar (not a viewer's): always the Creator blue, same width and offset as the Creator
 * ring in comments and the top bar. Used where the avatar is the channel's (row under the player, channel header,
 * subscription list), so the creator looks the same everywhere. Keeps the element's own border (no border-transparent),
 * because those avatars already sit in a bordered frame; the ring is a box-shadow, so it never moves the layout.
 */
export const CREATOR_AVATAR_RING = `${ROLE_RING_SPACING} ${ROLE_RING_COLOR.AUTHOR}`;
