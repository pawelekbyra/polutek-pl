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
import { authorize } from "@/lib/modules/authz";
import { isSubtitleLanguage, setTranslationSubtitle } from "@/lib/modules/translations";
import { COVER_MAX_BYTES, detectImage, validateVtt } from "../domain/files";

/** "pl" (original) or a translation language code ("en", "de", ...). */
export type SubtitleLang = string;

const notConfigured = () => new AppError("Magazyn R2 nie jest skonfigurowany w panelu (CLOUDFLARE_R2_*).", 503, "R2_NOT_CONFIGURED");

export async function uploadVideoCover(
  input: { videoId: string; bytes: Uint8Array },
  ctx: AppContext,
  storage: Pick<R2ThumbnailStorageClient, "putPrivate"> | null = R2ThumbnailStorageClient.isConfigured() ? new R2ThumbnailStorageClient() : null,
): Promise<UseCaseResult<{ thumbnailUrl: string }, AppError>> {
  const denied = await authorize(ctx, "video.update", { videoId: input.videoId });
  if (denied) return fail(denied);
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
 * pl and en live in Video.subtitleUrlPl/En (the player reads them); en is mirrored into its translation row;
 * other languages live on their VideoTranslation row, which must exist first (title saved).
 */
export async function uploadVideoSubtitle(
  input: { videoId: string; lang: SubtitleLang; bytes: Uint8Array },
  ctx: AppContext,
  storage: SubtitleStorage | null = defaultSubtitleStorage(),
): Promise<UseCaseResult<{ url: string; cues: number }, AppError>> {
  const denied = await authorize(ctx, "video.subtitles", { videoId: input.videoId });
  if (denied) return fail(denied);
  if (!isSubtitleLanguage(input.lang)) return fail(new AppError("Nieobsługiwany język napisów.", 400, "LANGUAGE_UNSUPPORTED"));
  const check = validateVtt(input.bytes);
  if (!check.ok) return fail(new AppError(check.reason, 400, "SUBTITLE_INVALID"));
  if (!storage) return fail(notConfigured());
  const current = await getAdminVideoById({ idOrSlug: input.videoId }, ctx);
  if (!current.ok) return fail(current.error as AppError);
  const previous = await currentSubtitle(input.lang, current.data, ctx);
  if (!previous.ok) return fail(previous.error);

  const bytes = new TextEncoder().encode(check.text);
  const { key } = await storage.putPrivate({ scope: `videos/${current.data.id}/subtitles`, bytes, contentType: "text/vtt; charset=utf-8", extension: "vtt" });
  const url = await storage.copyToPublic(key);
  await storage.deletePrivate(key).catch(() => undefined);

  const written = await writeSubtitle(input.lang, current.data.id, url, ctx);
  if (!written.ok) return fail(written.error);
  await removeOldSubtitleObject(previous.data, url, storage);
  await recordAuditEventSafe(ctx, { action: "VIDEO_SUBTITLES_UPLOADED", targetType: "Video", targetId: current.data.id, metadata: { lang: input.lang, cues: check.cues, sizeBytes: bytes.length } });
  return ok({ url, cues: check.cues });
}

export async function removeVideoSubtitle(
  input: { videoId: string; lang: SubtitleLang },
  ctx: AppContext,
  storage: SubtitleStorage | null = defaultSubtitleStorage(),
): Promise<UseCaseResult<{ removed: boolean }, AppError>> {
  const denied = await authorize(ctx, "video.subtitles", { videoId: input.videoId });
  if (denied) return fail(denied);
  if (!isSubtitleLanguage(input.lang)) return fail(new AppError("Nieobsługiwany język napisów.", 400, "LANGUAGE_UNSUPPORTED"));
  const current = await getAdminVideoById({ idOrSlug: input.videoId }, ctx);
  if (!current.ok) return fail(current.error as AppError);
  const previous = await currentSubtitle(input.lang, current.data, ctx);
  if (!previous.ok || !previous.data) return ok({ removed: false });
  const written = await writeSubtitle(input.lang, current.data.id, null, ctx);
  if (!written.ok) return fail(written.error);
  if (storage) await removeOldSubtitleObject(previous.data, null, storage);
  await recordAuditEventSafe(ctx, { action: "VIDEO_SUBTITLES_REMOVED", targetType: "Video", targetId: current.data.id, metadata: { lang: input.lang } });
  return ok({ removed: true });
}

type FilmSubs = { id: string; subtitleUrlPl?: string | null; subtitleUrlEn?: string | null };

async function currentSubtitle(lang: string, video: FilmSubs, ctx: AppContext): Promise<UseCaseResult<string | null, AppError>> {
  if (lang === "pl") return ok(video.subtitleUrlPl ?? null);
  if (lang === "en") return ok(video.subtitleUrlEn ?? null);
  const row = await ctx.prisma.videoTranslation.findUnique({ where: { videoId_language: { videoId: video.id, language: lang } }, select: { subtitleUrl: true } });
  if (!row) return fail(new AppError("Najpierw zapisz tytuł w tym języku, potem dodaj napisy.", 409, "TRANSLATION_MISSING"));
  return ok(row.subtitleUrl);
}

async function writeSubtitle(lang: string, videoId: string, url: string | null, ctx: AppContext): Promise<UseCaseResult<unknown, AppError>> {
  if (lang === "pl" || lang === "en") {
    const updated = await updateAdminVideo({ id: videoId, ...(lang === "pl" ? { subtitleUrlPl: url } : { subtitleUrlEn: url }) }, ctx);
    if (!updated.ok) return fail(updated.error as AppError);
    if (lang === "pl") return ok(null);
  }
  return setTranslationSubtitle({ videoId, language: lang, url }, ctx);
}

async function removeOldSubtitleObject(previousUrl: string | null | undefined, keepUrl: string | null, storage: SubtitleStorage) {
  if (!previousUrl || previousUrl === keepUrl) return;
  const key = parsePublicThumbnailUrl(previousUrl, process.env);
  // Only our own subtitle objects are deleted; an external URL from the old panel is just forgotten.
  if (key && key.includes("/subtitles/")) await storage.deletePublic(key).catch(() => undefined);
}
