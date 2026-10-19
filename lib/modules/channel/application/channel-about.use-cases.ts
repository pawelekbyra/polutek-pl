import type { Prisma } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import type { WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import { CHANNEL_ABOUT_MESSAGES, normalizeChannelLinks, normalizeContactEmail, parseStoredChannelLinks, type ChannelLink } from "../domain/channel-about";
import { resolveChannelBannerUrl, validateBannerDataUrl } from "../domain/channel-banner";
import { MainChannelPolicy } from "../domain/channel.policy";
import { MainChannelService } from "./main-channel.service";

/**
 * Channel page "About" data and banner (Studio). The caller must be OWNER or MANAGER of the context channel
 * (`channel.update`); every change writes one audit event with the channel id.
 */

export interface ChannelAboutDto {
  links: ChannelLink[];
  /** Public contact e-mail the creator chose to show (null = none). Never the account e-mail. */
  contactEmail: string | null;
  bannerUrl: string | null;
}

async function authorizeChannelEdit(ctx: AppContext) {
  const channel = await MainChannelService.getRequired(ctx);
  // By id, so the asking user's own membership (MANAGER) is loaded too; the owner is OWNER through Creator.userId.
  const denied = await authorize(ctx, "channel.update", { channelId: channel.id });
  return { channel, denied };
}

/** Current About data of the context channel, for the Studio forms. */
export async function getChannelAboutSettings(ctx: AppContext): Promise<UseCaseResult<ChannelAboutDto, AppError>> {
  const { channel, denied } = await authorizeChannelEdit(ctx);
  if (denied) return fail(denied);
  const row = await ctx.prisma.creator.findUnique({
    where: { id: channel.id },
    select: { id: true, links: true, publicContactEmail: true, bannerUpdatedAt: true },
  });
  return ok({
    links: parseStoredChannelLinks(row?.links),
    contactEmail: row?.publicContactEmail ?? null,
    bannerUrl: row ? resolveChannelBannerUrl(row) : null,
  });
}

export interface UpdateChannelAboutInput {
  links?: ReadonlyArray<{ title: unknown; url: unknown }>;
  /** Empty string or null removes the public contact e-mail. */
  contactEmail?: string | null;
}

export async function updateChannelAbout(
  ctx: AppContext,
  input: UpdateChannelAboutInput,
): Promise<UseCaseResult<ChannelAboutDto, AppError>> {
  const { channel, denied } = await authorizeChannelEdit(ctx);
  if (denied) return fail(denied);

  const data: { links?: ChannelLink[]; publicContactEmail?: string | null } = {};
  if (input.links !== undefined) {
    const links = normalizeChannelLinks(input.links);
    if (!links.ok) return fail(new AppError(CHANNEL_ABOUT_MESSAGES[links.problem], 400, `CHANNEL_ABOUT_${links.problem}`));
    data.links = links.links;
  }
  if (input.contactEmail !== undefined) {
    const email = normalizeContactEmail(input.contactEmail);
    if (!email.ok) return fail(new AppError(CHANNEL_ABOUT_MESSAGES[email.problem], 400, `CHANNEL_ABOUT_${email.problem}`));
    data.publicContactEmail = email.email;
  }
  if (Object.keys(data).length === 0) return getChannelAboutSettings(ctx);

  const row = await ctx.db.writeTransaction(async (tx: WriteTx) => {
    const updated = await tx.creator.update({
      where: { id: channel.id },
      data: {
        ...(data.links !== undefined ? { links: data.links as unknown as Prisma.InputJsonValue } : {}),
        ...(data.publicContactEmail !== undefined ? { publicContactEmail: data.publicContactEmail } : {}),
      },
      select: { id: true, links: true, publicContactEmail: true, bannerUpdatedAt: true },
    });
    await recordAuditEvent(ctx, {
      action: "CHANNEL_ABOUT_UPDATED",
      targetType: "Creator",
      targetId: channel.id,
      channelId: channel.id,
      // Field names and counts only: no e-mail address and no link targets in the audit log.
      metadata: {
        fields: Object.keys(data),
        ...(data.links !== undefined ? { linkCount: data.links.length } : {}),
        ...(data.publicContactEmail !== undefined ? { contactEmailShown: data.publicContactEmail !== null } : {}),
      },
    }, tx);
    return updated;
  });
  return ok({
    links: parseStoredChannelLinks(row.links),
    contactEmail: row.publicContactEmail ?? null,
    bannerUrl: resolveChannelBannerUrl(row),
  });
}

/** Stores the validated, browser-cropped banner (`dataUrl`), or removes it when `dataUrl` is null. */
export async function setChannelBanner(
  ctx: AppContext,
  input: { dataUrl: string | null },
): Promise<UseCaseResult<{ bannerUrl: string | null }, AppError>> {
  const { channel, denied } = await authorizeChannelEdit(ctx);
  if (denied) return fail(denied);

  const stored = input.dataUrl === null ? null : validateBannerDataUrl(input.dataUrl);
  if (stored && !stored.ok) {
    return fail(new AppError("Baner musi być obrazem JPG, PNG lub WebP o rozmiarze do 300 KB po przycięciu.", 400, "CHANNEL_BANNER_INVALID"));
  }

  const now = ctx.now();
  const row = await ctx.db.writeTransaction(async (tx: WriteTx) => {
    if (stored && stored.ok) {
      await tx.channelBanner.upsert({
        where: { channelId: channel.id },
        create: { channelId: channel.id, mime: stored.mime, data: new Uint8Array(stored.bytes) },
        update: { mime: stored.mime, data: new Uint8Array(stored.bytes) },
      });
    } else {
      await tx.channelBanner.deleteMany({ where: { channelId: channel.id } });
    }
    const updated = await tx.creator.update({
      where: { id: channel.id },
      data: { bannerUpdatedAt: stored ? now : null },
      select: { id: true, bannerUpdatedAt: true },
    });
    await recordAuditEvent(ctx, {
      action: stored ? "CHANNEL_BANNER_CHANGED" : "CHANNEL_BANNER_REMOVED",
      targetType: "Creator",
      targetId: channel.id,
      channelId: channel.id,
      metadata: stored && stored.ok ? { mime: stored.mime, bytes: stored.bytes.length } : {},
    }, tx);
    return updated;
  });
  return ok({ bannerUrl: resolveChannelBannerUrl(row) });
}

/** Banner bytes for the public route; only of a publicly visible channel. Public read (no authorization). */
export async function getPublicChannelBanner(ctx: AppContext, channelId: string) {
  const row = await ctx.prisma.channelBanner.findFirst({
    where: { channelId },
    select: { mime: true, data: true, channel: { select: { status: true, deletedAt: true } } },
  });
  if (!row || !MainChannelPolicy.isPubliclyVisible(row.channel)) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(row.mime)) return null;
  return { mime: row.mime, data: row.data };
}
