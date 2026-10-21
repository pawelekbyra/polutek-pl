import { AppContext } from "@/lib/modules/shared/app-context";

/**
 * Everything the service keeps about one account, as plain JSON the person can take with them
 * (GDPR art. 15 and 20; privacy policy section 5). Only the person's own rows: no other people's
 * data (a comment's replies, other viewers' reactions), no secrets (password hash, tokens, 2FA
 * secrets, session tokens, IP addresses) and nothing internal (moderation notes). Payments are
 * included because they are the person's own records; the card or bank details never reach us.
 */
export interface OwnDataExport {
  exportedAt: string;
  account: Record<string, unknown> | null;
  comments: unknown[];
  videoReactions: { videoId: string; type: "like" | "dislike"; createdAt: Date }[];
  commentReactions: unknown[];
  subscriptions: unknown[];
  emailPreferences: unknown[];
  payments: unknown[];
  /** Saved "resume watching" positions (one row per video, seconds). */
  videoProgress: { videoId: string; positionSeconds: number; durationSeconds: number | null; updatedAt: Date }[];
  /** Videos saved to the person's favorites. */
  videoFavorites: { videoId: string; createdAt: Date }[];
}

export class ExportOwnDataUseCase {
  static async execute(ctx: AppContext, userId: string): Promise<OwnDataExport> {
    const prisma = ctx.prisma;
    const [user, comments, likes, dislikes, commentReactions, subscriptions, emailPreferences, payments, videoProgress, videoFavorites] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, username: true, language: true, imageUrl: true,
          emailVerified: true, twoFactorEnabled: true, termsAcceptedAt: true, termsVersion: true,
          createdAt: true,
        },
      }),
      prisma.comment.findMany({
        where: { authorId: userId },
        select: {
          id: true, videoId: true, parentId: true, text: true, imageUrl: true, status: true,
          createdAt: true, editedAt: true, deletedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.videoLike.findMany({ where: { userId }, select: { videoId: true, createdAt: true } }),
      prisma.videoDislike.findMany({ where: { userId }, select: { videoId: true, createdAt: true } }),
      prisma.commentReaction.findMany({ where: { userId }, select: { commentId: true, type: true, createdAt: true } }),
      prisma.subscription.findMany({ where: { userId }, select: { creatorId: true, createdAt: true } }),
      prisma.emailPreference.findMany({
        where: { userId },
        select: { email: true, marketingEmails: true, systemEmails: true, unsubscribedAt: true, createdAt: true },
      }),
      prisma.payment.findMany({
        where: { userId },
        select: {
          id: true, amountMinor: true, currency: true, status: true, refundedAmountMinor: true,
          refundedAt: true, createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.videoProgress.findMany({
        where: { userId },
        select: { videoId: true, positionSeconds: true, durationSeconds: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.videoFavorite.findMany({ where: { userId }, select: { videoId: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);

    return {
      exportedAt: ctx.now().toISOString(),
      account: user,
      comments,
      videoReactions: [
        ...likes.map((row) => ({ ...row, type: "like" as const })),
        ...dislikes.map((row) => ({ ...row, type: "dislike" as const })),
      ],
      commentReactions,
      subscriptions,
      emailPreferences,
      payments,
      videoProgress,
      videoFavorites,
    };
  }
}
