import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoStatus } from "@prisma/client";
import { VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { isAllowedThumbnailUrl } from "@/lib/blob";
import { VideoPolicy } from "../domain/video.policy";
import { authorize } from "@/lib/modules/authz";

export type DiagnosticIssue = {
  severity: "ERROR" | "WARNING";
  message: string;
  field?: string;
  code?: string;
};

export type GetAdminVideoDiagnosticsInput = {
  videoId: string;
};

export async function getAdminVideoDiagnostics(
  input: GetAdminVideoDiagnosticsInput,
  ctx: AppContext
): Promise<UseCaseResult<DiagnosticIssue[]>> {
  const denied = await authorize(ctx, "video.preview", { videoId: input.videoId });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.db.read);

  const video = await repository.findByIdWithAsset(input.videoId);

  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const issues: DiagnosticIssue[] = [];

  // 1. Basic Content
  if (!video.title) issues.push({ severity: "ERROR", message: "Brak tytułu PL.", field: "title" });
  if (!video.titleEn) issues.push({ severity: "WARNING", message: "Brak tytułu EN.", field: "titleEn" });
  if (!video.description) issues.push({ severity: "WARNING", message: "Opis PL jest pusty.", field: "description" });
  if (!video.slug) issues.push({ severity: "ERROR", message: "Brak sluga (URL).", field: "slug" });

  // 2. Publication Status vs Data
  if (video.status === VideoStatus.PUBLISHED) {
      if (!video.thumbnailUrl) issues.push({ severity: "ERROR", message: "Film jest opublikowany, ale nie ma miniatury.", field: "thumbnailUrl" });
  }

  // 3. URLs & Security
  if (video.thumbnailUrl && !isAllowedThumbnailUrl(video.thumbnailUrl)) {
      issues.push({ severity: "WARNING", message: "Miniatura pochodzi z niezaufanego hosta.", field: "thumbnailUrl" });
  }

  // 4. Source: own HLS is the only supported video source (CLAUDE.md 4.17).
  const asset = video.asset;
  if (!asset) {
    issues.push({ severity: "ERROR", message: "Brak wideo: wgraj plik w zakładce Media, a kodowanie utworzy źródło własnego HLS.", field: "asset" });
  } else if (asset.provider !== VIDEO_PROVIDER.SELF_HLS) {
    issues.push({ severity: "ERROR", message: `Wykryto stare źródło (${asset.provider}), które nie jest już obsługiwane. Wgraj plik ponownie w zakładce Media.`, field: "asset" });
  } else if (asset.processingState === 'FAILED') {
    issues.push({ severity: "ERROR", message: "Kodowanie nie powiodło się. Sprawdź błąd w zakładce Media.", field: "asset" });
  } else if (asset.processingState !== 'READY') {
    issues.push({ severity: "WARNING", message: `Materiał jest w stanie: ${asset.processingState}.`, field: "asset" });
  }

  // 5. Layout & Logic
  for (const blocker of VideoPolicy.getPublicationBlockers(video)) {
      issues.push({ severity: "ERROR", code: blocker.code, message: `Publikacja zablokowana: ${blocker.message}`, field: blocker.field });
  }
  if (video.publishAfterAssetReadyError) {
      issues.push({ severity: "ERROR", code: "VIDEO_PUBLISH_AFTER_READY_ERROR", message: `Automatyczna publikacja po READY nie powiodła się: ${video.publishAfterAssetReadyError}`, field: "publishAfterAssetReady" });
  }
  if (asset?.processingState === 'FAILED') {
      issues.push({ severity: "ERROR", code: "VIDEO_PROVIDER_SYNC_FAILED", message: "Kodowanie zgłasza błąd (FAILED) dla zasobu. Sprawdź zakładkę Media.", field: "asset" });
  }
  if (video.isMainFeatured) {
      for (const blocker of VideoPolicy.getHeroBlockers(video)) {
          issues.push({ severity: "ERROR", code: blocker.code, message: `Hero zablokowany: ${blocker.message}`, field: blocker.field });
      }
  }
  if (video.showInSidebar) {
      for (const blocker of VideoPolicy.getSidebarBlockers(video)) {
          issues.push({ severity: "ERROR", code: blocker.code, message: `Sidebar zablokowany: ${blocker.message}`, field: "showInSidebar" });
      }
  }

  // 6. Uniqueness
  const hasDuplicateSlug = await repository.existsBySlugExcludingId(video.slug, video.id);
  if (hasDuplicateSlug) {
      issues.push({ severity: "ERROR", message: "Slug jest już używany przez inny film.", field: "slug" });
  }

  return ok(issues);
}
