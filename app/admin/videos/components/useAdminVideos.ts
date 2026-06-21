import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";
import { logger } from "@/lib/logger";
import { CreateVideoSourceMode } from "./VideoForm";
import { INITIAL_FORM_DATA } from "./video-utils";

export function useAdminVideos(isAdmin: boolean) {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<AdminVideoListItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSlugManual, setIsSlugManual] = useState<boolean>(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [createSourceMode, setCreateSourceMode] = useState<CreateVideoSourceMode>("UPLOAD");
  const [existingCloudflareSource, setExistingCloudflareSource] = useState("");
  const [createUploadState, setCreateUploadState] = useState<{
    videoId: string;
    publishAfterReady: boolean;
    isPublishing: boolean;
    isAttachingExisting?: boolean;
  } | null>(null);

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [sourceKindFilter, setSourceKindFilter] = useState<string>("ALL");
  const [migrationStatusFilter, setMigrationStatusFilter] = useState<string>("ALL");
  const [needsAttention, setNeedsAttention] = useState<boolean>(false);
  const [isMainFeatured, setIsMainFeatured] = useState<string>("ALL");
  const [showInSidebar, setShowInSidebar] = useState<string>("ALL");
  const [orderBy, setOrderBy] = useState<string>("createdAt");
  const [cloudflareHealth, setCloudflareHealth] = useState<{ configured: boolean; missing?: string[] } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/health/cloudflare")
      .then(async (res) => (res.ok ? setCloudflareHealth(await res.json()) : null))
      .catch((err) => logger.error("Failed to fetch Cloudflare health", err));
  }, [isAdmin]);

  const fetchVideos = useCallback(async (p = page) => {
    try {
      let url = `/api/admin/videos?page=${p}&query=${encodeURIComponent(searchQuery)}&orderBy=${orderBy}`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (tierFilter !== "ALL") url += `&tier=${tierFilter}`;
      if (sourceKindFilter !== "ALL") url += `&sourceKind=${sourceKindFilter}`;
      if (migrationStatusFilter !== "ALL") url += `&migrationStatus=${migrationStatusFilter}`;
      if (isMainFeatured !== "ALL") url += `&isMainFeatured=${isMainFeatured}`;
      if (showInSidebar !== "ALL") url += `&showInSidebar=${showInSidebar}`;
      if (needsAttention) url += `&needsAttention=true`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setVideos(data.items);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setStats(data.stats);
      }
    } catch (err) {
      logger.error("Failed to fetch videos", err);
    }
  }, [page, searchQuery, statusFilter, tierFilter, sourceKindFilter, migrationStatusFilter, needsAttention, isMainFeatured, showInSidebar, orderBy]);

  const fetchVideoForEdit = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/videos/${id}`);
      if (res.ok) {
        const vid = await res.json();
        setFormData({
          id: vid.id,
          title: vid.title,
          titleEn: vid.titleEn || "",
          slug: vid.slug,
          description: vid.description || "",
          descriptionEn: vid.descriptionEn || "",
          videoUrl: vid.videoUrl || "",
          thumbnailUrl: vid.thumbnailUrl || "",
          duration: vid.duration || "",
          tier: vid.tier as any,
          status: (vid.status || "PUBLISHED") as any,
          likesCount: vid.likesCount,
          dislikesCount: vid.dislikesCount,
          views: vid.views,
          isMainFeatured: vid.isMainFeatured || false,
          showInSidebar: vid.showInSidebar ?? true,
          sidebarOrder: vid.sidebarOrder || 0
        });
        setIsEditing(true);
        setIsSlugManual(true);
      }
    } catch (err) {
      logger.error("Failed to fetch video for edit", err);
    }
  }, []);

  return {
    error, setError, videos, setVideos, stats, setStats, isLoading, setIsLoading,
    isEditing, setIsEditing, isSubmitting, setIsSubmitting, formError, setFormError,
    isSlugManual, setIsSlugManual, selectedVideoFile, setSelectedVideoFile,
    createSourceMode, setCreateSourceMode, existingCloudflareSource, setExistingCloudflareSource,
    createUploadState, setCreateUploadState, formData, setFormData, total, setTotal,
    page, setPage, totalPages, setTotalPages, searchQuery, setSearchQuery,
    statusFilter, setStatusFilter, tierFilter, setTierFilter, sourceKindFilter, setSourceKindFilter,
    migrationStatusFilter, setMigrationStatusFilter, needsAttention, setNeedsAttention,
    isMainFeatured, setIsMainFeatured, showInSidebar, setShowInSidebar, orderBy, setOrderBy,
    cloudflareHealth, setCloudflareHealth, fetchVideos, fetchVideoForEdit
  };
}
