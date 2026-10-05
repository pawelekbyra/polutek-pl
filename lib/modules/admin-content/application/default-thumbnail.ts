/**
 * Default video thumbnail (Ustawienia → Kanał): the image films without their own cover fall back to.
 * Stored as the AppSetting `default_video_thumbnail` (the value the site already reads through
 * resolveVideoThumbnailUrl), the file in the private R2 thumbnail bucket. Moved out of the old
 * /api/admin route: same setting, but R2 only (no Vercel Blob fallback), bytes checked by magic number,
 * the new file is saved before the old one is deleted (no gap), every change is audited with before/after.
 */
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { MediaStorageService, R2ThumbnailStorageClient, invalidateDefaultThumbnailCache } from "@/lib/modules/media";
import { recordAuditEvent } from "@/lib/modules/audit";
import { COVER_MAX_BYTES, detectImage } from "../domain/files";

export const DEFAULT_THUMBNAIL_SETTING_KEY = "default_video_thumbnail";

type PutStorage = Pick<R2ThumbnailStorageClient, "putPrivate">;

export type DefaultThumbnailState = {
  storageUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /**
   * The old panel also let the owner type a URL on the Creator row, and that URL wins over the uploaded file
   * (resolveVideoThumbnailUrl). A non-null value here means the uploaded file is currently NOT the one shown;
   * saving or removing in the new panel clears it.
   */
  creatorOverrideUrl: string | null;
};

export async function getDefaultThumbnailState(ctx: AppContext): Promise<DefaultThumbnailState> {
  const [row, creator] = await Promise.all([
    ctx.prisma.appSetting.findUnique({ where: { key: DEFAULT_THUMBNAIL_SETTING_KEY } }),
    ctx.prisma.creator.findFirst({ where: { defaultThumbnailUrl: { not: null } }, select: { defaultThumbnailUrl: true } }),
  ]);
  return { storageUrl: row?.value ?? null, updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row?.updatedBy ?? null, creatorOverrideUrl: creator?.defaultThumbnailUrl ?? null };
}

/** Clears the legacy Creator URL (it would shadow the setting); returns how many rows had one. */
async function clearCreatorOverride(tx: Pick<AppContext["prisma"], "creator">): Promise<number> {
  const { count } = await tx.creator.updateMany({ where: { defaultThumbnailUrl: { not: null } }, data: { defaultThumbnailUrl: null } });
  return count;
}

const adminId = (ctx: AppContext) => (ctx.actor.type === "admin" ? ctx.actor.userId : undefined);

export async function setDefaultThumbnail(
  input: { bytes: Uint8Array },
  ctx: AppContext,
  storage: PutStorage | null = R2ThumbnailStorageClient.isConfigured() ? new R2ThumbnailStorageClient() : null,
  deleteStored: (url: string) => Promise<unknown> = (url) => MediaStorageService.deleteOwnedThumbnail(url),
): Promise<UseCaseResult<{ storageUrl: string; replaced: boolean }, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Tylko administrator zmienia domyślną miniaturę.", 403, "FORBIDDEN"));
  if (input.bytes.length === 0) return fail(new AppError("Plik jest pusty.", 400, "COVER_INVALID_TYPE"));
  if (input.bytes.length > COVER_MAX_BYTES) return fail(new AppError("Miniatura może mieć najwyżej 5 MB.", 400, "COVER_TOO_LARGE"));
  const kind = detectImage(input.bytes);
  if (!kind) return fail(new AppError("To nie jest obraz JPG, PNG ani WebP.", 400, "COVER_INVALID_TYPE"));
  if (!storage) return fail(new AppError("Magazyn R2 nie jest skonfigurowany w panelu (CLOUDFLARE_R2_*).", 503, "R2_NOT_CONFIGURED"));

  const before = await ctx.prisma.appSetting.findUnique({ where: { key: DEFAULT_THUMBNAIL_SETTING_KEY } });
  const { storageUrl } = await storage.putPrivate({ scope: "settings/default-video-thumbnail", bytes: input.bytes, contentType: kind.mime, extension: kind.extension });

  await ctx.db.writeTransaction(async (tx) => {
    const clearedCreatorUrls = await clearCreatorOverride(tx);
    await tx.appSetting.upsert({
      where: { key: DEFAULT_THUMBNAIL_SETTING_KEY },
      create: { key: DEFAULT_THUMBNAIL_SETTING_KEY, value: storageUrl, updatedBy: adminId(ctx) },
      update: { value: storageUrl, updatedBy: adminId(ctx) },
    });
    await recordAuditEvent(ctx, {
      action: "DEFAULT_THUMBNAIL_UPDATED",
      targetType: "AppSetting",
      targetId: DEFAULT_THUMBNAIL_SETTING_KEY,
      metadata: { before: before?.value ?? null, after: storageUrl, sizeBytes: input.bytes.length, contentType: kind.mime, clearedCreatorUrls, via: "admin_panel" },
    }, tx);
  });
  invalidateDefaultThumbnailCache();
  // The content-hashed key means re-uploading the same picture gives the same object: never delete that.
  if (before && before.value !== storageUrl) await deleteStored(before.value);
  return ok({ storageUrl, replaced: !!before });
}

export async function removeDefaultThumbnail(
  ctx: AppContext,
  deleteStored: (url: string) => Promise<unknown> = (url) => MediaStorageService.deleteOwnedThumbnail(url),
): Promise<UseCaseResult<{ deleted: boolean }, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Tylko administrator zmienia domyślną miniaturę.", 403, "FORBIDDEN"));
  const before = await ctx.prisma.appSetting.findUnique({ where: { key: DEFAULT_THUMBNAIL_SETTING_KEY } });
  if (!before) {
    // Nothing uploaded, but an old typed URL may still be set on the channel: removing means clearing it too.
    const clearedCreatorUrls = await clearCreatorOverride(ctx.prisma);
    if (clearedCreatorUrls === 0) return ok({ deleted: false });
    await recordAuditEvent(ctx, { action: "DEFAULT_THUMBNAIL_DELETED", targetType: "AppSetting", targetId: DEFAULT_THUMBNAIL_SETTING_KEY, metadata: { before: null, after: null, clearedCreatorUrls, via: "admin_panel" } });
    invalidateDefaultThumbnailCache();
    return ok({ deleted: true });
  }
  await ctx.db.writeTransaction(async (tx) => {
    const clearedCreatorUrls = await clearCreatorOverride(tx);
    await tx.appSetting.delete({ where: { key: DEFAULT_THUMBNAIL_SETTING_KEY } });
    await recordAuditEvent(ctx, {
      action: "DEFAULT_THUMBNAIL_DELETED",
      targetType: "AppSetting",
      targetId: DEFAULT_THUMBNAIL_SETTING_KEY,
      metadata: { before: before.value, after: null, clearedCreatorUrls, via: "admin_panel" },
    }, tx);
  });
  invalidateDefaultThumbnailCache();
  await deleteStored(before.value);
  return ok({ deleted: true });
}
