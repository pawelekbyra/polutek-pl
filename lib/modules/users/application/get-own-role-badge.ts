import type { AppContext } from "@/lib/modules/shared/app-context";
import { listVipUserIds } from "@/lib/modules/patron-zone";
import { pickRoleBadge, type RoleBadgeKind } from "@/lib/role-badge";

/**
 * The signed-in viewer's own public role for the top bar avatar ring: the same rule as the comment badges
 * (lib/role-badge.ts: Creator > VIP > Base). Creator = the account owns a (not deleted) channel, the account-level
 * counterpart of the comment rule "author of the video's channel". VIP = an active PAID patron-zone access, read
 * with the same helper as the comment badges (`listVipUserIds`, one `AppSetting` lookup by key). Two small
 * independent lookups, run in parallel and only for the viewer's own profile read; if the VIP lookup fails the
 * answer is `null` (unknown), never "Base", so a VIP is never shown as "Normik" (same rule as comment-vip.ts).
 */
export async function getOwnRoleBadge(ctx: Pick<AppContext, "prisma" | "now">, userId: string): Promise<RoleBadgeKind | null> {
  try {
    const [channel, vip] = await Promise.all([
      ctx.prisma.creator.findFirst({ where: { userId, deletedAt: null }, select: { id: true } }),
      listVipUserIds(ctx.prisma, [userId], ctx.now()),
    ]);
    return pickRoleBadge({ isCreator: channel !== null, isVip: vip.has(userId), isBase: true });
  } catch (error) {
    console.warn("[users] own role badge skipped", error instanceof Error ? error.message : "unknown");
    return null;
  }
}
