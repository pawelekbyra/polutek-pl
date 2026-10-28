/**
 * Cover and subtitle uploads of the admin panel. The bytes are checked here (magic bytes, real WebVTT),
 * stored in R2 (covers: private thumbnails bucket; subtitles: private HLS bucket), and the video row is changed only through updateAdminVideo (public thumbnail sync, old
 * cover clean-up, audit). No Vercel Blob fallback: the panel writes to R2 only.
 */
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { R2CaptionStorageClient, R2ThumbnailStorageClient, captionObjectKey, formatCaptionRef, parseCaptionRef, parsePublicThumbnailUrl } from "@/lib/modules/media";
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

/** Private caption files (bucket `polutek-hls`) plus the old public bucket, from which only legacy files are removed. */
export type SubtitleStorage = {
  putCaption: R2CaptionStorageClient["putCaption"];
  deleteCaption: R2CaptionStorageClient["deleteCaption"];
  /** Legacy: files of the public thumbnails bucket (before captions became private). Absent when that bucket is not configured. */
  deletePublic?: (key: string) => Promise<void>;
};

const defaultSubtitleStorage = (): SubtitleStorage | null => {
  if (!R2CaptionStorageClient.isConfigured()) return null;
  const captions = new R2CaptionStorageClient();
  const legacy = R2ThumbnailStorageClient.isPublicServingConfigured() ? new R2ThumbnailStorageClient() : null;
  return {
    putCaption: (input) => captions.putCaption(input),
    deleteCaption: (videoId, key) => captions.deleteCaption(videoId, key),
    ...(legacy ? { deletePublic: (key: string) => legacy.deletePublic(key) } : {}),
  };
};

/**
 * Subtitles are PRIVATE files of the HLS bucket: `videos/<id>/captions/<lang>-<sha256>.vtt` (content-hashed), never a
 * public object. The video row keeps a reference `hlscap:<lang>-<sha256>.vtt`; the playback plan turns it into a URL
 * under the video's own delivery token, only for a viewer who may play (CLAUDE.md 4.7, workers/hls-edge). The previous
 * file of the same language is removed after the row points at the new one; a failed row write removes the new file.
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
  let stored: { file: string; key: string };
  try {
    stored = await storage.putCaption({ videoId: current.data.id, lang: input.lang, bytes });
  } catch (error) {
    return fail(new AppError(`Nie udało się zapisać napisów w magazynie: ${error instanceof Error ? error.message : "błąd R2"}`, 502, "CAPTION_STORAGE_FAILED"));
  }
  const ref = formatCaptionRef(stored.file);

  const written = await writeSubtitle(input.lang, current.data.id, ref, ctx);
  if (!written.ok) {
    // The row does not point at the new file: do not leave it behind (unless it is the file the row already uses).
    if (previous.data !== ref) await storage.deleteCaption(current.data.id, stored.key).catch(() => undefined);
    return fail(written.error);
  }
  await removeOldSubtitleObject(current.data.id, previous.data, ref, storage);
  await recordAuditEventSafe(ctx, { action: "VIDEO_SUBTITLES_UPLOADED", targetType: "Video", targetId: current.data.id, metadata: { lang: input.lang, cues: check.cues, sizeBytes: bytes.length } });
  return ok({ url: ref, cues: check.cues });
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
  if (storage) await removeOldSubtitleObject(current.data.id, previous.data, null, storage);
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

async function removeOldSubtitleObject(videoId: string, previousValue: string | null | undefined, keepValue: string | null, storage: SubtitleStorage) {
  if (!previousValue || previousValue === keepValue) return;
  const ref = parseCaptionRef(previousValue);
  if (ref) {
    // A private caption (the file name carries the language, so no other language shares it).
    try {
      await storage.deleteCaption(videoId, captionObjectKey(videoId, ref.file));
    } catch {
      /* best effort, like every old-file removal; a leftover private file is not reachable by anyone */
    }
    return;
  }
  // Legacy public file (before captions became private). Only our own subtitle objects are deleted;
  // an external URL from the old panel is just forgotten.
  const key = parsePublicThumbnailUrl(previousValue, process.env);
  if (key && key.includes("/subtitles/") && storage.deletePublic) await storage.deletePublic(key).catch(() => undefined);
}
