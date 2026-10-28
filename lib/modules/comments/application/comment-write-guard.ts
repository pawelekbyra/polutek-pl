import type { AppContext } from "@/lib/modules/shared/app-context";
import type { CommentError } from "../domain/comment.errors";
import { isBannedFromChannel } from "./channel-ban.use-cases";

/**
 * The restrictions on WRITING a comment text, shared by adding and editing one (audit W17): an edit puts new words
 * under the video exactly like a new comment does, so a muted or blocked viewer must not get around the restriction
 * by rewriting an old comment. Both return the error to answer with, or `null` when the viewer may write.
 */

/** Moderation mute (admin panel): the account may read and react but not write until the date passes. */
export async function commentMuteError(ctx: AppContext, userId: string): Promise<CommentError | null> {
  if (ctx.actor.type !== "user") return null;
  const mute = await ctx.prisma.user.findUnique({ where: { id: userId }, select: { commentMutedUntil: true } });
  if (mute?.commentMutedUntil && mute.commentMutedUntil > ctx.now()) {
    return { type: "FORBIDDEN", message: "Komentowanie jest dla Twojego konta chwilowo wyłączone przez moderację." };
  }
  return null;
}

/**
 * The channel's block list (Studio "Zablokuj użytkownika"): the viewer may watch but not comment, reply or edit.
 * People who moderate the channel are never blocked. The reason and end date never reach the viewer.
 */
export async function channelBanError(ctx: AppContext, channelId: string, userId: string, canModerate: boolean): Promise<CommentError | null> {
  if (canModerate) return null;
  if (await isBannedFromChannel(ctx.prisma, channelId, userId, ctx.now())) {
    return { type: "FORBIDDEN", code: "CHANNEL_BANNED", message: "Nie możesz komentować filmów tego kanału." };
  }
  return null;
}
