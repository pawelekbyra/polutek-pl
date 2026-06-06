"use client";

import { logger } from "@/lib/logger";
import { useUser, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import Link from 'next/link';
import { Plus, ArrowLeft } from "@/app/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/app/components/Navbar";
import { VideoTable, type AdminVideo } from "./components/VideoTable";
import { VideoForm } from "./components/VideoForm";

export default function AdminVideosPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const toast = useToast();
  const { isLoaded: authLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSlugManual, setIsSlugManual] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    id: "",
    title: "",
    titleEn: "",
    slug: "",
    description: "",
    descriptionEn: "",
    videoUrl: "",
    thumbnailUrl: "",
    duration: "",
    tier: "PUBLIC",
    status: "PUBLISHED",
    likesCount: 0,
    dislikesCount: 0,
    views: 0,
    isMainFeatured: false,
    showInSidebar: true,
    sidebarOrder: 0
  });

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos");
      const data = await res.json() as AdminVideo[];
      setVideos(data);
    } catch (err) {
      logger.error("Failed to fetch videos", err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
        await fetchVideos();
    } finally {
        setIsLoading(false);
    }
  }, [fetchVideos]);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;

    if (!user) {
      setError("Zaloguj się, aby uzyskać dostęp do panelu.");
      setIsLoading(false);
      return;
    }

    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!res.ok) {
          setError("Brak uprawnień administratora.");
          setIsLoading(false);
          return;
        }

        setIsAdmin(true);
        fetchAll();
      } catch (err) {
        setError("Wystąpił błąd podczas weryfikacji uprawnień.");
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, [user, userLoaded, authLoaded, fetchAll]);


  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const handleTitleChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      title: val,
      slug: (prev.id || isSlugManual) ? prev.slug : slugify(val)
    }));
  };

  const handleEdit = (vid: AdminVideo) => {
    setFormError(null);
    setIsSlugManual(true);
    setFormData({
      id: vid.id,
      title: vid.title,
      titleEn: vid.titleEn || "",
      slug: vid.slug,
      description: vid.description || "",
      descriptionEn: vid.descriptionEn || "",
      videoUrl: vid.videoUrl,
      thumbnailUrl: vid.thumbnailUrl,
      duration: vid.duration || "",
      tier: vid.tier,
      status: vid.status || "PUBLISHED",
      likesCount: vid.likesCount,
      dislikesCount: vid.dislikesCount || 0,
      views: vid.views,
      isMainFeatured: vid.isMainFeatured,
      showInSidebar: vid.showInSidebar ?? true,
      sidebarOrder: vid.sidebarOrder || 0
    });
    setIsEditing(true);
  };

  const handleDuplicate = (vid: AdminVideo) => {
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
      videoUrl: vid.videoUrl,
      thumbnailUrl: vid.thumbnailUrl,
      duration: vid.duration || "",
      tier: vid.tier,
      status: "DRAFT",
      likesCount: 0,
      dislikesCount: 0,
      views: 0,
      isMainFeatured: false,
      showInSidebar: vid.showInSidebar ?? true,
      sidebarOrder: vid.sidebarOrder || 0
    });
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setFormError(null);
    setIsSlugManual(false);
    setFormData({
      id: "",
      title: "",
      titleEn: "",
      slug: "",
      description: "",
      descriptionEn: "",
      videoUrl: "",
      thumbnailUrl: "",
      duration: "",
      tier: "PUBLIC",
      status: "PUBLISHED",
      likesCount: 0,
      dislikesCount: 0,
      views: 0,
      isMainFeatured: false,
      showInSidebar: true,
      sidebarOrder: 0
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    const submissionData = {
      ...formData,
      title: formData.title?.trim(),
      description: formData.description?.trim() || null,
      titleEn: formData.titleEn?.trim() || null,
      descriptionEn: formData.descriptionEn?.trim() || null,
    };

    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData)
      });
      const data = await res.json();
      if (res.ok) {
        setIsEditing(false);
        fetchVideos();
      } else {
        setFormError(data.error || data.message || "Wystąpił błąd podczas zapisywania.");
      }
    } catch (err) {
      logger.error("Submit failed", err);
      setFormError("Błąd połączenia z serwerem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Zarchiwizuj film. Nie będzie widoczny publicznie, ale dane pozostaną w bazie.")) return;
      try {
          const res = await fetch(`/api/admin/videos?id=${id}`, { method: 'DELETE' });
          if (res.ok) {
              fetchVideos();
              toast("Pomyślnie zarchiwizowano film.", 'success');
          } else {
              const err = await res.json();
              toast("Błąd archiwizacji: " + err.error, 'error');
          }
      } catch (err) {
          logger.error("Delete failed", err);
      }
  }


  if (isLoading) {
    return (
      <AdminLayoutShell>
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">Weryfikacja dostępu...</div>
      </AdminLayoutShell>
    );
  }

  if (error) {
    return (
      <AdminLayoutShell>
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center space-y-4 p-4">
          <div className="text-destructive font-bold text-xl">{error}</div>
          <Button asChild><Link href="/">Wróć do strony głównej</Link></Button>
        </div>
      </AdminLayoutShell>
    );
  }

  if (!isAdmin) {
     return (
      <AdminLayoutShell>
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">Brak uprawnień.</div>
      </AdminLayoutShell>
    );
  }

  if (isEditing) {
    return (
      <AdminLayoutShell>
        <VideoForm
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          isSubmitting={isSubmitting}
          onCancel={() => setIsEditing(false)}
          onSubmit={handleSubmit}
          onTitleChange={handleTitleChange}
          onSlugChange={(val) => {
            setIsSlugManual(true);
            setFormData({...formData, slug: slugify(val)});
          }}
          slugify={slugify}
        />
      </AdminLayoutShell>
    );
  }

  return (
    <AdminLayoutShell>
      <div className="bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Filmy</h1>
            <p className="text-sm text-muted-foreground">Dodawanie, edycja, status publikacji, miniatury i dostęp.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do panelu
              </Link>
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" /> Nowy Film
            </Button>
          </div>
        </header>

        <div className="space-y-4 pt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Zarządzaj Materiałami</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <VideoTable
                          videos={videos}
                          onEdit={handleEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                        />
                    </CardContent>
                </Card>
        </div>
      </div>
      </div>
    </AdminLayoutShell>
  );
}

function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
