"use client";

import { use, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { useToast } from "@/app/hooks/useToast";
import { AdminLayoutShell } from "../../components/AdminLayoutShell";
import { AdminFormSkeleton } from "@/components/skeletons/admin";
import { VideoForm } from "../../components/VideoForm";
import { readAdminApiError } from "../../components/api-error";
import { INITIAL_FORM_DATA, slugify } from "../../components/video-utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type EditPageProps = {
  params: Promise<{ id: string }>;
};

type VideoFormData = typeof INITIAL_FORM_DATA;

function toEditableFormData(video: Record<string, unknown>): VideoFormData {
  return {
    id: String(video.id || ""),
    title: String(video.title || ""),
    titleEn: String(video.titleEn || ""),
    slug: String(video.slug || ""),
    description: String(video.description || ""),
    descriptionEn: String(video.descriptionEn || ""),
    videoUrl: String(video.videoUrl || ""),
    thumbnailUrl: String(video.thumbnailUrl || ""),
    duration: String(video.duration || ""),
    tier: String(video.tier || "PUBLIC"),
    status: String(video.status || "DRAFT"),
    likesCount: Number(video.likesCount || 0),
    dislikesCount: Number(video.dislikesCount || 0),
    views: Number(video.views || 0),
    isMainFeatured: Boolean(video.isMainFeatured),
    showInSidebar: Boolean(video.showInSidebar),
    sidebarOrder: Number(video.sidebarOrder || 0),
  };
}

export default function AdminVideoEditPage(props: EditPageProps) {
  const { id } = use(props.params);
  const router = useRouter();
  const toast = useToast();
  const [formData, setFormData] = useState<VideoFormData>(INITIAL_FORM_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSlugManual, setIsSlugManual] = useState(true);

  const loadVideo = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/videos/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(readAdminApiError(data, "Nie udało się pobrać filmu do edycji."));
        return;
      }

      setFormData(toEditableFormData(data));
      setIsSlugManual(true);
    } catch (error) {
      logger.error("Failed to load admin video edit page", error);
      setLoadError("Nie udało się pobrać filmu przez błąd połączenia.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const handleTitleChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug: isSlugManual ? prev.slug : slugify(val),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          title: formData.title.trim(),
          slug: formData.slug.trim(),
          description: formData.description.trim() || null,
          titleEn: formData.titleEn.trim() || null,
          descriptionEn: formData.descriptionEn.trim() || null,
          videoUrl: formData.videoUrl.trim() || null,
          thumbnailUrl: formData.thumbnailUrl.trim() || "",
          duration: formData.duration.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(readAdminApiError(data, "Nie udało się zapisać zmian."));
        return;
      }

      toast("Zapisano zmiany filmu.", "success");
      router.push(`/admin/videos/${encodeURIComponent(formData.id)}`);
      router.refresh();
    } catch (error) {
      logger.error("Admin video edit submit failed", error);
      setFormError("Nie udało się zapisać zmian przez błąd połączenia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/admin/videos/${encodeURIComponent(id)}`);
  };

  if (isLoading) {
    return (
      <AdminLayoutShell>
        <AdminFormSkeleton />
      </AdminLayoutShell>
    );
  }

  if (loadError) {
    return (
      <AdminLayoutShell>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="mb-4 text-2xl font-bold">Nie można otworzyć edycji</h1>
          <p className="mb-6 text-sm text-muted-foreground">{loadError}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={loadVideo}>Spróbuj ponownie</Button>
            <Button asChild><Link href={`/admin/videos/${encodeURIComponent(id)}`}>Wróć do filmu</Link></Button>
          </div>
        </main>
      </AdminLayoutShell>
    );
  }

  return (
    <AdminLayoutShell>
      {isSubmitting && <AdminFormSkeleton />}
      <VideoForm
        className={isSubmitting ? "hidden" : ""}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        isSubmitting={isSubmitting}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        onTitleChange={handleTitleChange}
        onSlugChange={(val) => {
          setIsSlugManual(true);
          setFormData((prev) => ({ ...prev, slug: slugify(val) }));
        }}
        slugify={slugify}
        selectedVideoFile={null}
        onVideoFileChange={() => {}}
        createSourceMode="UPLOAD"
        onCreateSourceModeChange={() => {}}
        existingCloudflareSource=""
        onExistingCloudflareSourceChange={() => {}}
      />
    </AdminLayoutShell>
  );
}
