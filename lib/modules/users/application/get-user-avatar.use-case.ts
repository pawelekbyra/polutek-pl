import { AppContext } from "@/lib/modules/shared/app-context";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Stored avatar bytes of a non-deleted user, or null (unknown id, no custom avatar, deleted account). */
export async function getUserAvatar(ctx: AppContext, userId: string) {
  const avatar = await ctx.prisma.userAvatar.findFirst({
    where: { userId, user: { isDeleted: false } },
    select: { mime: true, data: true },
  });
  if (!avatar || !ALLOWED_MIME.has(avatar.mime)) return null;
  return avatar;
}
