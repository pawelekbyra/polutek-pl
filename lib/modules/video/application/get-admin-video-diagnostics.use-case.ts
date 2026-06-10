import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoStatus, AccessTier } from "@prisma/client";
import { isAllowedVideoSourceUrl, isAllowedThumbnailUrl } from "@/lib/blob";

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

  // 4. Layout & Logic
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

  // 5. Uniqueness
  const hasDuplicateSlug = await repository.existsBySlugExcludingId(video.slug, video.id);
  if (hasDuplicateSlug) {
      issues.push({ severity: "ERROR", message: "Slug jest już używany przez inny film.", field: "slug" });
  }

  return ok(issues);
}
