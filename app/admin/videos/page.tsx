"use client";

import { logger } from "@/lib/logger";
import { useUser, useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type CreateVideoSourceMode } from "./components/VideoForm";
import { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";
import { AdminLayoutShell } from "./components/AdminLayoutShell";
import { VideoTableWrapper } from "./components/VideoTableWrapper";
import { readAdminApiError } from "./components/api-error";
import { buildCreatedVideoUploadUrl } from "./[id]/details-tab-state";
import { AdminVideoErrorView } from "./components/AdminVideoErrorView";
import { AdminVideoEditView } from "./components/AdminVideoEditView";
import { AdminVideoHeader } from "./components/AdminVideoHeader";
import { AdminVideoStats } from "./components/AdminVideoStats";
import { AdminVideoFiltersView } from "./components/AdminVideoFiltersView";
import { slugify, normalizeCloudflareSource, INITIAL_FORM_DATA, inferThumbnailSourceMode } from "./components/video-utils";
import { useAdminVideos } from "./components/useAdminVideos";

export default function AdminVideosPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded: authLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [deleteDialogVideoId, setDeleteDialogVideoId] = useState<string | null>(null);

  const {
    error, setError, videos, stats, isInitialLoading, setIsInitialLoading, isRefetching,
    isEditing, setIsEditing, isSubmitting, setIsSubmitting, formError, setFormError,
    isSlugManual, setIsSlugManual, selectedVideoFile, setSelectedVideoFile,
    createSourceMode, setCreateSourceMode, existingCloudflareSource, setExistingCloudflareSource,
    createUploadState, setCreateUploadState, formData, setFormData, total,
    page, totalPages, searchQuery, setSearchQuery,
    statusFilter, setStatusFilter, tierFilter, setTierFilter, sourceKindFilter, setSourceKindFilter,
    migrationStatusFilter, setMigrationStatusFilter, needsAttention, setNeedsAttention,
    isMainFeatured, setIsMainFeatured, showInSidebar, setShowInSidebar, orderBy, setOrderBy,
    cloudflareHealth, fetchVideos, fetchVideoForEdit
  } = useAdminVideos(isAdmin);

  const loadAdminVideos = useCallback(async () => {
    setIsAdmin(true);
    setIsInitialLoading(true);
    await fetchVideos(1);
    setIsInitialLoading(false);
  }, [fetchVideos, setIsInitialLoading]);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;
    if (!user) {
      setError("Zaloguj się, aby uzyskać dostęp do panelu.");
      setIsInitialLoading(false);
      return;
    }
    loadAdminVideos();
  }, [user, userLoaded, authLoaded, loadAdminVideos, setError, setIsInitialLoading]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && isAdmin) {
        fetchVideoForEdit(editId);
    }
  }, [searchParams, isAdmin, fetchVideoForEdit]);

  useEffect(() => {
      if (isAdmin && !isInitialLoading) fetchVideos(1, { pending: true });
  }, [statusFilter, tierFilter, sourceKindFilter, migrationStatusFilter, needsAttention, isMainFeatured, showInSidebar, orderBy, isAdmin, isInitialLoading, fetchVideos]);

  const handleTitleChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      title: val,
      slug: (prev.id || isSlugManual) ? prev.slug : slugify(val)
    }));
  };

  const handleEdit = (vid: AdminVideoListItem) => {
    const asset = (vid as any).asset;
    setFormError(null);
    setIsSlugManual(true);
    setFormData({
      id: vid.id,
      title: vid.title,
      titleEn: vid.titleEn || "",
      slug: vid.slug,
      description: vid.description || "",
      descriptionEn: vid.descriptionEn || "",
      videoUrl: vid.videoUrl || "",
      thumbnailUrl: vid.thumbnailUrl || "",
      thumbnailSource: inferThumbnailSourceMode(vid.thumbnailUrl),
      cloudflareProviderAssetId: asset?.providerAssetId || "",
      duration: "",
      tier: vid.tier,
      status: vid.status || "PUBLISHED",
      likesCount: vid.likesCount,
      dislikesCount: vid.dislikesCount,
      views: vid.views,
      isMainFeatured: vid.isMainFeatured || false,
      showInSidebar: vid.showInSidebar ?? true,
      sidebarOrder: vid.sidebarOrder || 0
    });
    setSelectedVideoFile(null);
    setExistingCloudflareSource("");
    setCreateSourceMode("UPLOAD");
    setCreateUploadState(null);
    setIsEditing(true);
  };

  const handleDuplicate = (vid: AdminVideoListItem) => {
    setFormError(null);
    setIsSlugManual(false);
    const newTitle = `${vid.title} (Kopia)`;
    setFormData({
      id: "",
      title: newTitle,
      titleEn: vid.titleEn ? `${vid.titleEn} (Copy)` : "",
      slug: slugify(newTitle) + "-" + Math.floor(Math.random() * 1000),
      description: vid.description || "",
      descriptionEn: vid.descriptionEn || "",
      videoUrl: "",
      thumbnailUrl: vid.thumbnailUrl || "",
      thumbnailSource: inferThumbnailSourceMode(vid.thumbnailUrl),
      cloudflareProviderAssetId: "",
      duration: "",
      tier: vid.tier,
      status: "DRAFT",
      likesCount: 0,
      dislikesCount: 0,
      views: 0,
      isMainFeatured: false,
      showInSidebar: false,
      sidebarOrder: 0
    });
    setSelectedVideoFile(null);
    setExistingCloudflareSource("");
    setCreateSourceMode("UPLOAD");
    setCreateUploadState(null);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setFormError(null);
    setIsSlugManual(false);
    setFormData(INITIAL_FORM_DATA);
    setSelectedVideoFile(null);
    setExistingCloudflareSource("");
    setCreateSourceMode("UPLOAD");
    setCreateUploadState(null);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const intent = submitter?.dataset.intent === "PUBLISHED" || (!submitter && formData.status === "PUBLISHED") ? "PUBLISHED" : "DRAFT";
    const existingProviderAssetId = normalizeCloudflareSource(existingCloudflareSource);
    const hasCreateSource = createSourceMode === "UPLOAD" ? Boolean(selectedVideoFile) : Boolean(existingProviderAssetId);
    if (!formData.id && intent === "PUBLISHED" && !hasCreateSource) {
      setFormError("Wybierz plik albo podaj istniejący Cloudflare Stream UID/adres przed publikacją. Szkic możesz zapisać bez źródła.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData.id ? {
          ...formData,
          title: formData.title?.trim(),
          slug: formData.slug?.trim(),
          description: formData.description?.trim() || null,
          titleEn: formData.titleEn?.trim() || null,
          descriptionEn: formData.descriptionEn?.trim() || null,
          videoUrl: formData.videoUrl?.trim() || null,
          thumbnailUrl: formData.thumbnailSource === "CUSTOM" ? formData.thumbnailUrl?.trim() || "" : formData.thumbnailUrl?.trim() || "",
          thumbnailSource: formData.thumbnailSource,
        } : {
          title: formData.title?.trim(),
          slug: formData.slug?.trim(),
          description: formData.description?.trim() || null,
          titleEn: formData.titleEn?.trim() || null,
          descriptionEn: formData.descriptionEn?.trim() || null,
          thumbnailUrl: formData.thumbnailSource === "CUSTOM" ? formData.thumbnailUrl?.trim() || "" : "",
          thumbnailSource: formData.thumbnailSource,
          duration: formData.duration?.trim() || null,
          tier: formData.tier,
          publishAfterAssetReady: intent === "PUBLISHED",
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (formData.id) {
          setIsEditing(false);
        } else if (createSourceMode === "UPLOAD" && selectedVideoFile) {
          setCreateUploadState({
            videoId: data.id,
            publishAfterReady: intent === "PUBLISHED",
            isPublishing: false,
            thumbnailSource: formData.thumbnailSource,
          });
          toast(
            intent === "PUBLISHED"
              ? "Szkic utworzony. Rozpoczynam upload; publikacja nastąpi po przetworzeniu wideo."
              : "Szkic utworzony. Rozpoczynam upload pliku.",
            "success",
          );
        } else if (createSourceMode === "EXISTING_CLOUDFLARE" && existingProviderAssetId) {
          setCreateUploadState({
            videoId: data.id,
            publishAfterReady: intent === "PUBLISHED",
            isPublishing: false,
            isAttachingExisting: true,
            thumbnailSource: formData.thumbnailSource,
          });
          await attachExistingCloudflareAsset(data.id, existingProviderAssetId, intent === "PUBLISHED", formData.thumbnailSource);
        } else {
          setIsEditing(false);
        }
        if (formData.id && searchParams.get("edit")) {
          router.replace("/admin/videos");
        } else if (!formData.id && !hasCreateSource) {
          router.push(buildCreatedVideoUploadUrl(data.id));
        }
        await fetchVideos(page, { pending: true });
      } else {
        setFormError(readAdminApiError(data, "Wystąpił błąd podczas zapisywania."));
      }
    } catch (err) {
      logger.error("Submit failed", err);
      setFormError("Błąd połączenia z serwerem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const attachExistingCloudflareAsset = useCallback(async (videoId: string, providerAssetId: string, publishAfterReady: boolean, thumbnailSource: string) => {
    try {
      const attachRes = await fetch(`/api/admin/videos/${videoId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach-asset", providerAssetId, publishAfterAssetReady: publishAfterReady, thumbnailSource }),
      });
      const attachData = await attachRes.json();
      if (!attachRes.ok) {
        setFormError(readAdminApiError(attachData, "Nie udało się podpiąć istniejącego assetu Cloudflare."));
        setCreateUploadState(null);
        return;
      }

      const syncRes = await fetch(`/api/admin/videos/${videoId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-cloudflare" }),
      });
      if (!syncRes.ok) {
        const syncData = await syncRes.json();
        setFormError(readAdminApiError(syncData, "Asset został podpięty, ale nie udało się potwierdzić statusu Cloudflare."));
        setCreateUploadState(null);
        return;
      }

      if (publishAfterReady) {
        toast("Istniejący asset Cloudflare został podpięty. Jeśli nie jest jeszcze READY, backend opublikuje film automatycznie po synchronizacji/webhooku albo zapisze błąd do diagnostyki.", "success");
      } else {
        toast("Istniejący asset Cloudflare został podpięty do szkicu.", "success");
      }

      setIsEditing(false);
      setCreateUploadState(null);
      setExistingCloudflareSource("");
      router.push(`/admin/videos/${encodeURIComponent(videoId)}?tab=media#media`);
    } catch (err) {
      logger.error("Attach existing Cloudflare asset failed", err);
      setFormError("Nie udało się podpiąć istniejącego assetu Cloudflare przez błąd połączenia.");
    } finally {
      setCreateUploadState((prev) => prev ? { ...prev, isAttachingExisting: false } : prev);
    }
  }, [router, toast, setCreateUploadState, setExistingCloudflareSource, setFormError, setIsEditing]);

  const handleDelete = async (id: string) => {
      setDeleteDialogVideoId(null);
      setDeletingVideoId(id);
      try {
          const res = await fetch(`/api/admin/videos?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
              await fetchVideos(page, { pending: true });
              toast("Pomyślnie usunięto film oraz powiązany asset Cloudflare Stream, jeśli był podpięty.", 'success');
          } else {
              const err = await res.json();
              toast("Błąd usuwania filmu/Cloudflare Stream: " + readAdminApiError(err, "Nie udało się usunąć filmu albo assetu Cloudflare Stream."), 'error');
          }
      } catch (err) {
          logger.error("Delete failed", err);
          toast("Błąd połączenia podczas usuwania filmu i assetu Cloudflare Stream.", 'error');
      } finally {
          setDeletingVideoId(null);
      }
  };

  if (error) {
    return <AdminVideoErrorView error={error} onRetry={() => { setError(null); loadAdminVideos(); }} />;
  }

  if (!isAdmin && !isInitialLoading) return <AdminLayoutShell><div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">Brak uprawnień.</div></AdminLayoutShell>;

  if (isEditing) {
    return (
      <AdminVideoEditView
        isSubmitting={isSubmitting}
        createUploadState={createUploadState}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        onCancel={() => setIsEditing(false)}
        onSubmit={handleSubmit}
        onTitleChange={handleTitleChange}
        onSlugChange={(val) => { setIsSlugManual(true); setFormData({...formData, slug: slugify(val)}); }}
        slugify={slugify}
        selectedVideoFile={selectedVideoFile}
        onVideoFileChange={setSelectedVideoFile}
        createSourceMode={createSourceMode}
        onCreateSourceModeChange={(mode) => {
          setCreateSourceMode(mode);
          setSelectedVideoFile(null);
          setExistingCloudflareSource("");
        }}
        existingCloudflareSource={existingCloudflareSource}
        onExistingCloudflareSourceChange={setExistingCloudflareSource}
        fetchVideos={fetchVideos}
        page={page}
      />
    );
  }

  return (
    <AdminLayoutShell>
      <div className="bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <AdminVideoHeader onCreateNew={handleCreateNew} />

        {cloudflareHealth && !cloudflareHealth.configured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
            Cloudflare Stream nie jest skonfigurowany — upload nowych filmów nie będzie działał.
          </div>
        )}

        {stats && <AdminVideoStats stats={stats} />}

        <AdminVideoFiltersView
            searchQuery={searchQuery} setSearchQuery={setSearchQuery} fetchVideos={fetchVideos}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            tierFilter={tierFilter} setTierFilter={setTierFilter}
            sourceKindFilter={sourceKindFilter} setSourceKindFilter={setSourceKindFilter}
            migrationStatusFilter={migrationStatusFilter} setMigrationStatusFilter={setMigrationStatusFilter}
            isMainFeatured={isMainFeatured} setIsMainFeatured={setIsMainFeatured}
            showInSidebar={showInSidebar} setShowInSidebar={setShowInSidebar}
            orderBy={orderBy} setOrderBy={setOrderBy}
            needsAttention={needsAttention} setNeedsAttention={setNeedsAttention}
        />

        <VideoTableWrapper
            isInitialLoading={isInitialLoading} isRefetching={isRefetching} total={total} videos={videos} page={page} totalPages={totalPages}
            onEdit={handleEdit} onDuplicate={handleDuplicate} onDelete={setDeleteDialogVideoId} deletingVideoId={deletingVideoId} onPageChange={(nextPage) => fetchVideos(nextPage, { pending: true })}
        />

        <Dialog open={deleteDialogVideoId !== null} onOpenChange={(open) => { if (!open) setDeleteDialogVideoId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usunąć film?</DialogTitle>
              <DialogDescription>
                Usunięcie obejmuje film w bazie oraz powiązany asset Cloudflare Stream, jeśli istnieje. Jeśli Cloudflare zwróci błąd, operacja zostanie przerwana i film nie zostanie usunięty.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Anuluj
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => { if (deleteDialogVideoId) void handleDelete(deleteDialogVideoId); }}
                disabled={deletingVideoId !== null}
              >
                {deletingVideoId ? "Usuwanie…" : "Usuń film"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </AdminLayoutShell>
  );
}
