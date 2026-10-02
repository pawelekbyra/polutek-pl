"use client";

import { logger } from "@/lib/logger";
import { useUser, useAuth } from "@/lib/auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoForm, type CreateVideoSourceMode } from "./components/VideoForm";
import { AdminVideoListItem } from "@/lib/modules/video/domain/admin-video-list.dto";
import { AdminLayoutShell } from "./components/AdminLayoutShell";
import { VideoTableWrapper } from "./components/VideoTableWrapper";
import { readAdminApiError } from "@/lib/admin/api-error";
import { buildCreatedVideoUploadUrl } from "./[id]/details-tab-state";
import { AdminVideoErrorView } from "./components/AdminVideoErrorView";
import { AdminVideoEditView } from "./components/AdminVideoEditView";
import { AdminVideoHeader } from "./components/AdminVideoHeader";
import { AdminVideoStats } from "./components/AdminVideoStats";
import { AdminVideoFiltersView } from "./components/AdminVideoFiltersView";
import { slugify, INITIAL_FORM_DATA, buildPublicationPayload, publicationFormFields } from "./components/video-utils";
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
    createSourceMode, setCreateSourceMode,
    createUploadState, setCreateUploadState, formData, setFormData, total,
    page, totalPages, searchQuery, setSearchQuery,
    statusFilter, setStatusFilter, tierFilter, setTierFilter, sourceKindFilter, setSourceKindFilter,
    migrationStatusFilter, setMigrationStatusFilter, needsAttention, setNeedsAttention,
    isMainFeatured, setIsMainFeatured, showInSidebar, setShowInSidebar, orderBy, setOrderBy,
    fetchVideos, fetchVideoForEdit
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
      duration: "",
      tier: vid.tier,
      status: vid.status || "PUBLISHED",
      likesCount: vid.likesCount,
      dislikesCount: vid.dislikesCount,
      views: vid.views,
      isMainFeatured: vid.isMainFeatured || false,
      showInSidebar: vid.showInSidebar ?? true,
      sidebarOrder: vid.sidebarOrder || 0,
      subtitleUrlPl: "",
      subtitleUrlEn: "",
      ...publicationFormFields(vid),
    });
    setSelectedVideoFile(null);
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
      duration: "",
      tier: vid.tier,
      status: "DRAFT",
      likesCount: 0,
      dislikesCount: 0,
      views: 0,
      isMainFeatured: false,
      showInSidebar: false,
      sidebarOrder: 0,
      subtitleUrlPl: "",
      subtitleUrlEn: "",
      ...publicationFormFields({}),
    });
    setSelectedVideoFile(null);
    setCreateSourceMode("UPLOAD");
    setCreateUploadState(null);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setFormError(null);
    setIsSlugManual(false);
    setFormData(INITIAL_FORM_DATA);
    setSelectedVideoFile(null);
    setCreateSourceMode("UPLOAD");
    setCreateUploadState(null);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const intent = submitter?.dataset.intent === "PUBLISHED" || (!submitter && formData.status === "PUBLISHED") ? "PUBLISHED" : "DRAFT";
    const hasCreateSource = (() => {
      if (createSourceMode === "UPLOAD") return Boolean(selectedVideoFile);
      return false; // NONE
    })();
    if (!formData.id && intent === "PUBLISHED" && !hasCreateSource && createSourceMode !== "NONE") {
      setFormError("Wybierz plik przed publikacją. Szkic możesz zapisać bez źródła.");
      return;
    }
    const publication = buildPublicationPayload(formData);
    if ("error" in publication) return setFormError(publication.error);
    // Editing a draft with "Premiera" publishes it (the server keeps the publication blockers).
    const editStatus = formData.publishMode === "PREMIERE" && formData.status === "DRAFT" ? "PUBLISHED" : formData.status;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData.id ? {
          id: formData.id,
          title: formData.title?.trim(),
          slug: formData.slug?.trim(),
          description: formData.description?.trim() || null,
          titleEn: formData.titleEn?.trim() || null,
          descriptionEn: formData.descriptionEn?.trim() || null,
          videoUrl: formData.videoUrl?.trim() || null,
          thumbnailUrl: formData.thumbnailUrl?.trim() || "",
          tier: formData.tier,
          status: editStatus,
          isMainFeatured: formData.isMainFeatured,
          showInSidebar: formData.showInSidebar,
          sidebarOrder: formData.sidebarOrder,
          ...publication,
        } : {
          title: formData.title?.trim(),
          slug: formData.slug?.trim(),
          description: formData.description?.trim() || null,
          titleEn: formData.titleEn?.trim() || null,
          descriptionEn: formData.descriptionEn?.trim() || null,
          thumbnailUrl: formData.thumbnailUrl?.trim() || "",
          duration: formData.duration?.trim() || null,
          tier: formData.tier,
          publishAfterAssetReady: intent === "PUBLISHED",
          ...publication,
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
          });
          toast(
            intent === "PUBLISHED"
              ? "Szkic utworzony. Rozpoczynam upload; publikacja nastąpi po przetworzeniu wideo."
              : "Szkic utworzony. Rozpoczynam upload pliku.",
            "success",
          );
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

  const handleMetadataSaveDuringUpload = async () => {
    if (!createUploadState?.videoId) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/videos/${createUploadState.videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title?.trim(),
          slug: formData.slug?.trim(),
          description: formData.description?.trim() || null,
          titleEn: formData.titleEn?.trim() || null,
          descriptionEn: formData.descriptionEn?.trim() || null,
          thumbnailUrl: formData.thumbnailUrl?.trim() || "",
          tier: formData.tier,
        })
      });
      if (res.ok) {
        toast("Metadane zostały zapisane w trakcie uploadu.", "success");
        await fetchVideos(page, { pending: true });
      } else {
        const data = await res.json();
        setFormError(readAdminApiError(data, "Nie udało się zapisać metadanych."));
      }
    } catch (err) {
      logger.error("Metadata save during upload failed", err);
      setFormError("Błąd połączenia z serwerem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      setDeleteDialogVideoId(null);
      setDeletingVideoId(id);
      try {
          const res = await fetch(`/api/admin/videos?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
              await fetchVideos(page, { pending: true });
              toast("Pomyślnie usunięto film wraz z plikami.", 'success');
          } else {
              const err = await res.json();
              toast("Błąd usuwania filmu: " + readAdminApiError(err, "Nie udało się usunąć filmu."), 'error');
          }
      } catch (err) {
          logger.error("Delete failed", err);
          toast("Błąd połączenia podczas usuwania filmu.", 'error');
      } finally {
          setDeletingVideoId(null);
      }
  }

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
        }}
        fetchVideos={fetchVideos}
        page={page}
        onMetadataSaveDuringUpload={handleMetadataSaveDuringUpload}
      />
    );
  }

  return (
    <AdminLayoutShell>
      <div className="bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <AdminVideoHeader onCreateNew={handleCreateNew} />

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

        <Dialog open={deleteDialogVideoId !== null} onOpenChange={(open: boolean) => { if (!open) setDeleteDialogVideoId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usunąć film?</DialogTitle>
              <DialogDescription>
                Usunięcie obejmuje film w bazie oraz jego pliki w naszym magazynie (oryginał i zakodowane wersje HLS). Tego nie da się cofnąć.
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
