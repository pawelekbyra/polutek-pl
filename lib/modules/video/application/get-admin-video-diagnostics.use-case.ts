import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoStatus, AccessTier } from "@prisma/client";
import { VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { isAllowedVideoSourceUrl, isAllowedThumbnailUrl } from "@/lib/blob";
import { MediaPolicy } from "@/lib/modules/media";
import { hasReadyProviderBackedPlaybackAsset, isLegacyPrivatePlaybackFallbackAllowed } from "@/lib/services/playback/legacy-private-fallback.policy";
import { VideoPolicy } from "../domain/video.policy";

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
      if (!video.videoUrl) issues.push({ severity: "ERROR", message: "Film jest opublikowany, ale nie ma linku do wideo.", field: "videoUrl" });
      if (!video.thumbnailUrl) issues.push({ severity: "ERROR", message: "Film jest opublikowany, ale nie ma miniatury.", field: "thumbnailUrl" });
  }

  // 3. URLs & Security
  if (video.videoUrl && !isAllowedVideoSourceUrl(video.videoUrl)) {
      issues.push({ severity: "ERROR", message: "Link do wideo pochodzi z niezaufanego hosta.", field: "videoUrl" });
  }
  if (video.thumbnailUrl && !isAllowedThumbnailUrl(video.thumbnailUrl)) {
      issues.push({ severity: "WARNING", message: "Miniatura pochodzi z niezaufanego hosta.", field: "thumbnailUrl" });
  }

  // 4. Migration & Storage
  const asset = video.asset;
  const isCloudflare = asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM;

  if (isCloudflare) {
    if (asset.processingState === 'READY') {
      // No warning needed for READY state.
    } else if (asset.processingState === 'FAILED') {
      issues.push({ severity: "ERROR", message: "Przetwarzanie Cloudflare Stream nie powiodło się. Sprawdź błąd w zakładce Media.", field: "asset" });
    } else {
      const isStale = asset.updatedAt && (new Date().getTime() - new Date(asset.updatedAt).getTime() > 60 * 60 * 1000);
      issues.push({
        severity: isStale ? "ERROR" : "WARNING",
        message: `Zasób Cloudflare jest w stanie: ${asset.processingState}.${isStale ? " Przetwarzanie trwa zbyt długo - użyj 'Synchronizuj status' w zakładce Media." : ""}`,
        field: "asset"
      });
    }
  } else if (asset) {
    // R2, S3, VERCEL_BLOB
    issues.push({ severity: "WARNING", message: `Wykryto starego dostawcę zasobów (legacy): ${asset.provider}. Wymagana migracja do Cloudflare Stream. Skorzystaj z opcji Importu w zakładce Media.`, field: "asset" });
  } else if (video.videoUrl) {
    issues.push({ severity: "WARNING", message: "Wykryto stary link videoUrl (legacy) bez zasobu Cloudflare. Użyj 'Importuj legacy URL' w zakładce Media.", field: "videoUrl" });
  } else {
    issues.push({ severity: "ERROR", message: "Brak źródła wideo (brak assetu i brak starego linku legacy).", field: "videoUrl" });
  }

  // Security Check for Private Legacy URLs
  if (video.tier === AccessTier.PATRON && !hasReadyProviderBackedPlaybackAsset(asset)) {
    if (!isLegacyPrivatePlaybackFallbackAllowed()) {
      issues.push({ severity: "ERROR", message: "Film dla patronów nie ma gotowego zasobu Cloudflare Stream/Mux; obsługa starych linków (legacy playback fallback) jest wyłączona i film będzie nieodtwarzalny do czasu migracji.", field: asset ? "asset" : "videoUrl" });
    }

    if (!isCloudflare && video.videoUrl && MediaPolicy.isProbablyRawMediaUrl(video.videoUrl)) {
      issues.push({ severity: "ERROR", message: "Film dla patronów korzysta z bezpośredniego, potencjalnie niezabezpieczonego starego linku (legacy).", field: "videoUrl" });
    }
  }

  // 5. Layout & Logic
  for (const blocker of VideoPolicy.getPublicationBlockers(video)) {
      issues.push({ severity: "ERROR", code: blocker.code, message: `Publikacja zablokowana: ${blocker.message}`, field: blocker.field });
  }
  if (video.publishAfterAssetReadyError) {
      issues.push({ severity: "ERROR", code: "VIDEO_PUBLISH_AFTER_READY_ERROR", message: `Automatyczna publikacja po READY nie powiodła się: ${video.publishAfterAssetReadyError}`, field: "publishAfterAssetReady" });
  }
  if (asset?.processingState === 'FAILED') {
      issues.push({ severity: "ERROR", code: "VIDEO_PROVIDER_SYNC_FAILED", message: "Synchronizacja dostawcy zgłasza błąd (FAILED) dla zasobu. Użyj synchronizacji Cloudflare albo sprawdź diagnostykę mediów.", field: "asset" });
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
