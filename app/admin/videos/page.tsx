"use client";

import { logger } from "@/lib/logger";
import { useUser, useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import Link from 'next/link';
import { Plus, ArrowLeft } from "@/app/components/icons";
import { Button } from "@/components/ui/button";
import { VideoForm } from "./components/VideoForm";
import { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";
import { AdminFormSkeleton, AdminVideosPageSkeleton } from "@/components/skeletons/admin";
import { AdminLayoutShell, StatMiniCard } from "./components/AdminLayoutShell";
import { VideoFilters } from "./components/VideoFilters";
import { VideoTableWrapper } from "./components/VideoTableWrapper";

export default function AdminVideosPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded: authLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<AdminVideoListItem[]>([]);
  const [stats, setStats] = useState<any>(null);
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
  }, [page, searchQuery, statusFilter, tierFilter, sourceKindFilter, needsAttention, isMainFeatured, showInSidebar, orderBy]);

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
      } else {
        toast("Nie udało się pobrać danych filmu do edycji.", "error");
      }
    } catch (err) {
      logger.error("Failed to fetch video for edit", err);
    }
  }, [toast]);

  const checkAdmin = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) {
        setError("Brak uprawnień administratora.");
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);
      setIsLoading(false);
      fetchVideos(1);
    } catch (err) {
      setError("Wystąpił błąd podczas weryfikacji uprawnień.");
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
    checkAdmin();
  }, [user, userLoaded, authLoaded, checkAdmin]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && isAdmin) {
        fetchVideoForEdit(editId);
    }
  }, [searchParams, isAdmin, fetchVideoForEdit]);

  useEffect(() => {
      if (isAdmin) fetchVideos(1);
  }, [statusFilter, tierFilter, sourceKindFilter, migrationStatusFilter, needsAttention, isMainFeatured, showInSidebar, orderBy, isAdmin, fetchVideos]);

  const slugify = (text: string) => {
    return text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  };

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
      videoUrl: vid.videoUrl || "",
      thumbnailUrl: vid.thumbnailUrl || "",
      duration: "",
      tier: vid.tier as any,
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
      id: "", title: "", titleEn: "", slug: "", description: "", descriptionEn: "", videoUrl: "", thumbnailUrl: "", duration: "", tier: "PUBLIC", status: "PUBLISHED", likesCount: 0, dislikesCount: 0, views: 0, isMainFeatured: false, showInSidebar: true, sidebarOrder: 0
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          title: formData.title?.trim(),
          description: formData.description?.trim() || null,
          titleEn: formData.titleEn?.trim() || null,
          descriptionEn: formData.descriptionEn?.trim() || null,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsEditing(false);
        if (searchParams.get("edit")) router.replace("/admin/videos");
        fetchVideos(page);
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
              fetchVideos(page);
              toast("Pomyślnie zarchiwizowano film.", 'success');
          } else {
              const err = await res.json();
              toast("Błąd archiwizacji: " + err.error, 'error');
          }
      } catch (err) {
          logger.error("Delete failed", err);
      }
  }

  if (isLoading) return <AdminLayoutShell><AdminVideosPageSkeleton /></AdminLayoutShell>;

  if (error) {
    return (
      <AdminLayoutShell>
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center space-y-4 p-4">
          <div className="text-destructive font-bold text-xl">{error}</div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => { setError(null); setIsLoading(true); checkAdmin(); }}>Spróbuj ponownie</Button>
            <Button asChild><Link href="/">Wróć do strony głównej</Link></Button>
          </div>
        </div>
      </AdminLayoutShell>
    );
  }

  if (!isAdmin) return <AdminLayoutShell><div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">Brak uprawnień.</div></AdminLayoutShell>;

  if (isEditing) {
    return (
      <AdminLayoutShell>
        {isSubmitting && <AdminFormSkeleton />}
        <VideoForm
          className={isSubmitting ? "hidden" : ""}
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          isSubmitting={isSubmitting}
          onCancel={() => setIsEditing(false)}
          onSubmit={handleSubmit}
          onTitleChange={handleTitleChange}
          onSlugChange={(val) => { setIsSlugManual(true); setFormData({...formData, slug: slugify(val)}); }}
          slugify={slugify}
        />
      </AdminLayoutShell>
    );
  }

  return (
    <AdminLayoutShell>
      <div className="bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Filmy</h1>
            <p className="text-sm text-muted-foreground">Dodawanie, edycja, status publikacji, miniatury i dostęp.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do panelu</Link></Button>
            <Button variant="outline" asChild><Link href="/admin/videos/layout">Układ kanału</Link></Button>
            <Button onClick={handleCreateNew}><Plus className="mr-2 h-4 w-4" /> Nowy Film</Button>
          </div>
        </header>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <StatMiniCard label="Wszystkie" value={stats.total} />
            <StatMiniCard label="Publikacje" value={stats.published} color="green" />
            <StatMiniCard label="Szkice" value={stats.drafts} color="amber" />
            <StatMiniCard label="Archiv" value={stats.archived} color="red" />
            <StatMiniCard label="Public" value={stats.public} />
            <StatMiniCard label="Login" value={stats.loggedIn} />
            <StatMiniCard label="Patron" value={stats.patron} color="amber" />
          </div>
        )}

        <VideoFilters
            searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} onSearchSubmit={() => fetchVideos(1)}
            statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
            tierFilter={tierFilter} onTierFilterChange={setTierFilter}
            sourceKindFilter={sourceKindFilter} onSourceKindFilterChange={setSourceKindFilter}
            migrationStatusFilter={migrationStatusFilter} onMigrationStatusFilterChange={setMigrationStatusFilter}
            isMainFeatured={isMainFeatured} onIsMainFeaturedChange={setIsMainFeatured}
            showInSidebar={showInSidebar} onShowInSidebarChange={setShowInSidebar}
            orderBy={orderBy} onOrderByChange={setOrderBy}
            needsAttention={needsAttention} onNeedsAttentionChange={setNeedsAttention}
        />

        <VideoTableWrapper
            isLoading={isLoading} total={total} videos={videos} page={page} totalPages={totalPages}
            onEdit={handleEdit} onDuplicate={handleDuplicate} onDelete={handleDelete} onPageChange={fetchVideos}
        />
      </div>
      </div>
    </AdminLayoutShell>
  );
}
