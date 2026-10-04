/**
 * Cover and subtitle uploads of the admin panel. The bytes are checked here (magic bytes, real WebVTT),
 * stored in R2, and the video row is changed only through updateAdminVideo (public thumbnail sync, old
 * cover clean-up, audit). No Vercel Blob fallback: the panel writes to R2 only.
 */
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { R2ThumbnailStorageClient, parsePublicThumbnailUrl } from "@/lib/modules/media";
import { getAdminVideoById, updateAdminVideo } from "@/lib/modules/video";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { COVER_MAX_BYTES, detectImage, validateVtt } from "../domain/files";

export type SubtitleLang = "pl" | "en";

const notConfigured = () => new AppError("Magazyn R2 nie jest skonfigurowany w panelu (CLOUDFLARE_R2_*).", 503, "R2_NOT_CONFIGURED");

export async function uploadVideoCover(
  input: { videoId: string; bytes: Uint8Array },
  ctx: AppContext,
  storage: Pick<R2ThumbnailStorageClient, "putPrivate"> | null = R2ThumbnailStorageClient.isConfigured() ? new R2ThumbnailStorageClient() : null,
): Promise<UseCaseResult<{ thumbnailUrl: string }, AppError>> {
  if (input.bytes.length > COVER_MAX_BYTES) return fail(new AppError("Miniatura może mieć najwyżej 5 MB.", 400, "COVER_TOO_LARGE"));
  const kind = detectImage(input.bytes);
  if (!kind) return fail(new AppError("To nie jest obraz JPG, PNG ani WebP.", 400, "COVER_INVALID_TYPE"));
  if (!storage) return fail(notConfigured());
  const exists = await getAdminVideoById({ idOrSlug: input.videoId }, ctx);
  if (!exists.ok) return fail(exists.error as AppError);
  const { storageUrl } = await storage.putPrivate({ scope: `videos/${exists.data.id}/covers`, bytes: input.bytes, contentType: kind.mime, extension: kind.extension });
  const updated = await updateAdminVideo({ id: input.videoId, thumbnailUrl: storageUrl }, ctx);
  if (!updated.ok) return fail(updated.error as AppError);
  await recordAuditEventSafe(ctx, { action: "VIDEO_COVER_UPLOADED", targetType: "Video", targetId: input.videoId, metadata: { storage: "r2", sizeBytes: input.bytes.length, contentType: kind.mime, via: "admin_panel" } });
  return ok({ thumbnailUrl: storageUrl });
}

type SubtitleStorage = Pick<R2ThumbnailStorageClient, "putPrivate" | "copyToPublic" | "deletePrivate" | "deletePublic">;

const defaultSubtitleStorage = (): SubtitleStorage | null => (R2ThumbnailStorageClient.isPublicServingConfigured() ? new R2ThumbnailStorageClient() : null);

/**
 * Subtitles are served from the public R2 host (the player fetches them like the thumbnails) under a
 * content-hashed key `videos/<id>/subtitles/<hash>.vtt`; the public-thumbnail reconcile leaves that prefix
 * alone. The previous file of the same language is removed after the row points at the new one.
 */
export async function uploadVideoSubtitle(
  input: { videoId: string; lang: SubtitleLang; bytes: Uint8Array },
  ctx: AppContext,
  storage: SubtitleStorage | null = defaultSubtitleStorage(),
): Promise<UseCaseResult<{ url: string; cues: number }, AppError>> {
  const check = validateVtt(input.bytes);
  if (!check.ok) return fail(new AppError(check.reason, 400, "SUBTITLE_INVALID"));
  if (!storage) return fail(notConfigured());
  const current = await getAdminVideoById({ idOrSlug: input.videoId }, ctx);
  if (!current.ok) return fail(current.error as AppError);
  const previous = input.lang === "pl" ? current.data.subtitleUrlPl : current.data.subtitleUrlEn;

  const bytes = new TextEncoder().encode(check.text);
  const { key } = await storage.putPrivate({ scope: `videos/${input.videoId}/subtitles`, bytes, contentType: "text/vtt; charset=utf-8", extension: "vtt" });
  const url = await storage.copyToPublic(key);
  await storage.deletePrivate(key).catch(() => undefined);

  const updated = await updateAdminVideo({ id: input.videoId, ...(input.lang === "pl" ? { subtitleUrlPl: url } : { subtitleUrlEn: url }) }, ctx);
  if (!updated.ok) return fail(updated.error as AppError);
  await removeOldSubtitleObject(previous, url, storage);
  await recordAuditEventSafe(ctx, { action: "VIDEO_SUBTITLES_UPLOADED", targetType: "Video", targetId: input.videoId, metadata: { lang: input.lang, cues: check.cues, sizeBytes: bytes.length } });
  return ok({ url, cues: check.cues });
}

export async function removeVideoSubtitle(
  input: { videoId: string; lang: SubtitleLang },
  ctx: AppContext,
  storage: SubtitleStorage | null = defaultSubtitleStorage(),
): Promise<UseCaseResult<{ removed: boolean }, AppError>> {
  const current = await getAdminVideoById({ idOrSlug: input.videoId }, ctx);
  if (!current.ok) return fail(current.error as AppError);
  const previous = input.lang === "pl" ? current.data.subtitleUrlPl : current.data.subtitleUrlEn;
  if (!previous) return ok({ removed: false });
  const updated = await updateAdminVideo({ id: input.videoId, ...(input.lang === "pl" ? { subtitleUrlPl: null } : { subtitleUrlEn: null }) }, ctx);
  if (!updated.ok) return fail(updated.error as AppError);
  if (storage) await removeOldSubtitleObject(previous, null, storage);
  await recordAuditEventSafe(ctx, { action: "VIDEO_SUBTITLES_REMOVED", targetType: "Video", targetId: input.videoId, metadata: { lang: input.lang } });
  return ok({ removed: true });
}

async function removeOldSubtitleObject(previousUrl: string | null | undefined, keepUrl: string | null, storage: SubtitleStorage) {
  if (!previousUrl || previousUrl === keepUrl) return;
  const key = parsePublicThumbnailUrl(previousUrl, process.env);
  // Only our own subtitle objects are deleted; an external URL from the old panel is just forgotten.
  if (key && key.includes("/subtitles/")) await storage.deletePublic(key).catch(() => undefined);
}
