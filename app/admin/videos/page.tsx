"use client";

import { logger } from "@/lib/logger";
import { useUser, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/hooks/useToast";
import Link from 'next/link';
import { Plus, ArrowLeft, Search, Filter } from "@/app/components/icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Navbar from "@/app/components/Navbar";
import { VideoTable } from "./components/VideoTable";
import { VideoForm } from "./components/VideoForm";
import { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";

export default function AdminVideosPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const toast = useToast();
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
  const [needsAttention, setNeedsAttention] = useState<boolean>(false);
  const [isMainFeatured, setIsMainFeatured] = useState<string>("ALL");
  const [showInSidebar, setShowInSidebar] = useState<string>("ALL");
  const [orderBy, setOrderBy] = useState<string>("createdAt");

  const fetchVideos = useCallback(async (p = page) => {
    try {
      let url = `/api/admin/videos?page=${p}&query=${encodeURIComponent(searchQuery)}&orderBy=${orderBy}`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (tierFilter !== "ALL") url += `&tier=${tierFilter}`;
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
  }, [page, searchQuery, statusFilter, tierFilter, needsAttention, isMainFeatured, showInSidebar, orderBy]);

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

  // Refetch when filters change (except search which has its own button)
  useEffect(() => {
      if (isAdmin) fetchVideos(1);
  }, [statusFilter, tierFilter, needsAttention, isMainFeatured, showInSidebar, orderBy, isAdmin, fetchVideos]);


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
      duration: "", // Would need from detail
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
      <div className="max-w-7xl mx-auto space-y-8">
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
            <Button variant="outline" asChild>
              <Link href="/admin/videos/layout">Układ kanału</Link>
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" /> Nowy Film
            </Button>
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

        <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                <form onSubmit={(e) => { e.preventDefault(); fetchVideos(1); }} className="w-full lg:w-1/3 flex gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Szukaj po tytule, slugu..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button type="submit">Szukaj</Button>
                </form>

                <div className="flex flex-wrap gap-2 items-center flex-1">
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "ALL")}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
                            <SelectItem value="PUBLISHED">Opublikowane</SelectItem>
                            <SelectItem value="DRAFT">Szkice</SelectItem>
                            <SelectItem value="ARCHIVED">Zarchiwizowane</SelectItem>
                            <SelectItem value="UNLISTED">Niepubliczne</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={tierFilter} onValueChange={(v) => setTierFilter(v || "ALL")}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Poziom" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Wszystkie poziomy</SelectItem>
                            <SelectItem value="PUBLIC">Publiczne</SelectItem>
                            <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
                            <SelectItem value="PATRON">Patroni</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={isMainFeatured} onValueChange={(v) => setIsMainFeatured(v || "ALL")}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue placeholder="Hero" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Hero: Dowolny</SelectItem>
                            <SelectItem value="true">Tylko Hero</SelectItem>
                            <SelectItem value="false">Bez Hero</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={showInSidebar} onValueChange={(v) => setShowInSidebar(v || "ALL")}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue placeholder="Sidebar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Sidebar: Dowolny</SelectItem>
                            <SelectItem value="true">W sidebarze</SelectItem>
                            <SelectItem value="false">Ukryte</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={orderBy} onValueChange={(v) => setOrderBy(v || "createdAt")}>
                        <SelectTrigger className="w-[160px] h-9">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3 w-3 opacity-70" />
                                <SelectValue placeholder="Sortuj" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">Najnowsze</SelectItem>
                            <SelectItem value="views">Najwięcej wyświetleń</SelectItem>
                            <SelectItem value="likesCount">Najwięcej polubień</SelectItem>
                            <SelectItem value="sidebarOrder">Kolejność sidebar</SelectItem>
                            <SelectItem value="updatedAt">Ostatnio zmienione</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-md h-9">
                        <Checkbox id="attention" checked={needsAttention} onCheckedChange={(val) => setNeedsAttention(!!val)} />
                        <Label htmlFor="attention" className="text-xs font-medium cursor-pointer">Wymaga uwagi</Label>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4 pt-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle>Zarządzaj Materiałami</CardTitle>
                            <CardDescription>Znaleziono {total} filmów.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <VideoTable
                          videos={videos}
                          onEdit={handleEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                        />

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-8 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => fetchVideos(page - 1)}
                                >
                                    Poprzednia
                                </Button>
                                <div className="text-sm font-medium">
                                    Strona <span className="text-primary">{page}</span> z {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === totalPages}
                                    onClick={() => fetchVideos(page + 1)}
                                >
                                    Następna
                                </Button>
                            </div>
                        )}
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

function StatMiniCard({ label, value, color }: { label: string, value: number, color?: string }) {
    const colorClasses: any = {
        green: "text-green-600 border-green-100 bg-green-50/50",
        amber: "text-amber-600 border-amber-100 bg-amber-50/50",
        red: "text-red-600 border-red-100 bg-red-50/50",
    };
    return (
        <div className={`p-2 rounded-lg border text-center ${colorClasses[color || ''] || 'bg-muted/30'}`}>
            <p className="text-[9px] uppercase font-bold opacity-60 truncate">{label}</p>
            <p className="text-lg font-black">{value}</p>
        </div>
    );
}
