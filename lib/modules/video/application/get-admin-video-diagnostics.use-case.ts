import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoStatus, AccessTier } from "@prisma/client";
import { VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { isAllowedVideoSourceUrl, isAllowedThumbnailUrl } from "@/lib/blob";
import { MediaPolicy } from "@/lib/modules/media";

export type DiagnosticIssue = {
  severity: "ERROR" | "WARNING";
  message: string;
  field?: string;
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
      issues.push({ severity: "ERROR", message: "Przetwarzanie Cloudflare Stream nie powiodło się.", field: "asset" });
    } else {
      issues.push({ severity: "WARNING", message: `Zasób Cloudflare jest w stanie: ${asset.processingState}`, field: "asset" });
    }
  } else if (asset) {
    // R2, S3, VERCEL_BLOB
    issues.push({ severity: "WARNING", message: `Wykryto legacy asset provider: ${asset.provider}. Wymagana migracja do Cloudflare Stream.`, field: "asset" });
  } else if (video.videoUrl) {
    issues.push({ severity: "WARNING", message: "Wykryto legacy videoUrl bez dedykowanego zasobu providera. Wymagana migracja do Cloudflare Stream.", field: "videoUrl" });
  } else {
    issues.push({ severity: "ERROR", message: "Brak źródła wideo (brak assetu i brak legacy URL).", field: "videoUrl" });
  }

  // Security Check for Private Legacy URLs
  if (video.tier === AccessTier.PATRON && !isCloudflare && video.videoUrl) {
    if (MediaPolicy.isProbablyRawMediaUrl(video.videoUrl)) {
      issues.push({ severity: "ERROR", message: "Film dla patronów korzysta z bezpośredniego, potencjalnie niezabezpieczonego linku legacy.", field: "videoUrl" });
    }
  }

  // 5. Layout & Logic
  if (video.isMainFeatured && video.status !== VideoStatus.PUBLISHED) {
      issues.push({ severity: "ERROR", message: "Film Hero musi być opublikowany.", field: "status" });
  }
  if (video.isMainFeatured && video.tier !== AccessTier.PUBLIC) {
      issues.push({ severity: "ERROR", message: "Film Hero musi być publiczny.", field: "tier" });
  }
  if (video.showInSidebar && video.status === VideoStatus.ARCHIVED) {
      issues.push({ severity: "WARNING", message: "Film zarchiwizowany nie powinien być w sidebarze.", field: "showInSidebar" });
  }
  if (video.showInSidebar && video.status !== VideoStatus.PUBLISHED) {
      issues.push({ severity: "WARNING", message: "Tylko opublikowane filmy powinny być widoczne w sidebarze.", field: "showInSidebar" });
  }

  // 6. Uniqueness
  const hasDuplicateSlug = await repository.existsBySlugExcludingId(video.slug, video.id);
  if (hasDuplicateSlug) {
      issues.push({ severity: "ERROR", message: "Slug jest już używany przez inny film.", field: "slug" });
  }

  return ok(issues);
}
