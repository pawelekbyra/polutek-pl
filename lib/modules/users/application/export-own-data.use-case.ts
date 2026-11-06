import { AppContext } from "@/lib/modules/shared/app-context";
import { AVATAR_MAX_DATA_URL_CHARS } from "@/lib/auth/avatar";
import { BANNER_MAX_DATA_URL_CHARS } from "@/lib/modules/channel/domain/channel-banner-limits";
import { AppError } from "@/lib/modules/shared/app-error";

const EXPORT_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function encodeOwnedImage(input: { type: "avatar" | "channel_banner"; ownerId: string; mime: string; data: Uint8Array }, maxDataUrlChars: number) {
  const data = Buffer.from(input.data);
  const dataUrlChars = `data:${input.mime};base64,`.length + Math.ceil(data.byteLength / 3) * 4;
  if (!EXPORT_IMAGE_MIMES.has(input.mime) || dataUrlChars > maxDataUrlChars) {
    throw new AppError("Stored image cannot be safely exported", 500, "OWN_DATA_IMAGE_INVALID");
  }
  return { type: input.type, ownerId: input.ownerId, mime: input.mime, dataBase64: data.toString("base64") };
}

/**
 * Everything the service keeps about one account, as plain JSON the person can take with them
 * (GDPR art. 15 and 20; privacy policy section 5). Only the person's own rows: no other people's
 * data (a comment's replies, other viewers' reactions), no secrets (password hash, tokens, 2FA
 * secrets, session tokens, IP addresses) and nothing internal (moderation notes). Payments are
 * included because they are the person's own records; the card or bank details never reach us.
 */
export interface OwnDataExport {
  /** Increment when the shape or meaning of this portable JSON contract changes. */
  schemaVersion: 1;
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
  /** Profiles owned by this account; moderation internals and binary media are intentionally excluded. */
  creatorProfiles: unknown[];
  /** This person's role and acceptance timestamps in channels they belong to. */
  channelMemberships: unknown[];
  /** Explicit null means no preference row exists and the application defaults apply. */
  notificationPreferences: unknown | null;
  /** Own notification event metadata; message text and template params are excluded. */
  notifications: { kind: string; read: boolean; createdAt: Date }[];
  /** The person's patron history, without internal reviewer IDs, reasons, or payment provider IDs. */
  patronGrants: unknown[];
  /** The person's own bounded avatar and channel-banner bytes, portable as Base64. */
  mediaAttachments: { type: "avatar" | "channel_banner"; ownerId: string; mime: string; dataBase64: string }[];
}

export class ExportOwnDataUseCase {
  static async execute(ctx: AppContext, userId: string): Promise<OwnDataExport> {
    const prisma = ctx.prisma;
    const [user, comments, likes, dislikes, commentReactions, subscriptions, emailPreferences, payments, videoProgress, videoFavorites, creatorProfiles, channelMemberships, notificationPreferences, notifications, patronGrants, avatar] = await Promise.all([
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
      prisma.creator.findMany({
        where: { userId },
        select: {
          id: true, slug: true, name: true, bio: true, handle: true, avatarUrl: true,
          bannerUpdatedAt: true, links: true, publicContactEmail: true, country: true,
          language: true, isVerified: true, status: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.channelMember.findMany({
        where: { userId },
        select: { channelId: true, role: true, acceptedAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.notificationPreference.findUnique({
        where: { userId },
        select: {
          patronEnabled: true, commentEnabled: true, systemEnabled: true,
          newVideoInApp: true, newVideoEmail: true, moderationEnabled: true, updatedAt: true,
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { kind: true, read: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.patronGrant.findMany({
        where: { userId },
        select: { source: true, createdAt: true, revokedAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userAvatar.findUnique({ where: { userId }, select: { mime: true, data: true } }),
    ]);

    const banners = creatorProfiles.length === 0
      ? []
      : await prisma.channelBanner.findMany({
          where: { channelId: { in: creatorProfiles.map((profile) => profile.id) } },
          select: { channelId: true, mime: true, data: true },
          orderBy: { channelId: "asc" },
        });

    const mediaAttachments = [
      ...(avatar ? [encodeOwnedImage({ type: "avatar", ownerId: userId, ...avatar }, AVATAR_MAX_DATA_URL_CHARS)] : []),
      ...banners.map((banner) => encodeOwnedImage(
        { type: "channel_banner", ownerId: banner.channelId, ...banner },
        BANNER_MAX_DATA_URL_CHARS,
      )),
    ];

    return {
      schemaVersion: 1,
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
      creatorProfiles,
      channelMemberships,
      notificationPreferences,
      notifications,
      patronGrants,
      mediaAttachments,
    };
  }
}
