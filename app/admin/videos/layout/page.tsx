"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Star, Layout, Eye, EyeOff, Save, RefreshCcw } from "@/app/components/icons";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { logger } from "@/lib/logger";
import Image from "next/image";
import { useToast } from "@/app/hooks/useToast";
import { AdminVideoLayoutSkeleton } from "@/components/skeletons/admin";
import type { AdminVideoListItem } from "@/lib/services/admin/videos-admin.dto";

export default function ChannelLayoutPage() {
  const [videos, setVideos] = useState<AdminVideoListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSubmitting] = useState(false);
  const toast = useToast();

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/videos?pageSize=100&orderBy=sidebarOrder&orderDir=asc");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.items);
      }
    } catch (err) {
      logger.error("Failed to fetch videos for layout", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const moveItem = (index: number, direction: 'up' | 'down') => {
      const newVideos = [...videos];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newVideos.length) return;

      const [movedItem] = newVideos.splice(index, 1);
      newVideos.splice(targetIndex, 0, movedItem);

      const updated = newVideos.map((v, idx) => ({
          ...v,
          sidebarOrder: idx + 1
      }));

      setVideos(updated);
  };

  const toggleSidebar = (video: AdminVideoListItem) => {
      setVideos(prev => prev.map(v => v.id === video.id ? { ...v, showInSidebar: !v.showInSidebar } : v));
  };

  const setAsHero = (video: AdminVideoListItem) => {
      setVideos(prev => prev.map(v => ({
          ...v,
          isMainFeatured: v.id === video.id
      })));
  };

  const handleSave = async () => {
      setIsSubmitting(true);
      try {
          const res = await fetch("/api/admin/videos/reorder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videos: videos.map(v => ({
                  id: v.id,
                  sidebarOrder: v.sidebarOrder,
                  showInSidebar: v.showInSidebar,
                  isMainFeatured: v.isMainFeatured
              }))})
          });

          if (res.ok) {
              toast("Układ kanału został zapisany.", "success");
              fetchVideos();
          } else {
              throw new Error("API error");
          }
      } catch (err) {
          logger.error("Failed to save layout", err);
          toast("Wystąpił błąd podczas zapisywania.", "error");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
           <AdminVideoLayoutSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
            <AdminNavigation backHref="/admin/videos" backLabel="Wróć do listy filmów" currentLabel="Układ filmów" breadcrumbs={[{ href: "/admin/videos", label: "Filmy" }]} className="" />
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchVideos} disabled={isSaving}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Odśwież
                </Button>
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? "Zapisywanie..." : "Zapisz zmiany"}
                </Button>
            </div>
        </div>

        <div className="mb-8 rounded-3xl border bg-card p-6 shadow-sm md:p-8 text-center md:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Zarządzanie Kanałem</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Układ i Kolejność</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Zmieniaj kolejność filmów strzałkami, wybierz główny film Hero (tylko publiczne) i zarządzaj widocznością w sidebarze.
          </p>
        </div>

        <div className="space-y-3">
            {videos.map((video, index) => (
                <Card key={video.id} className={video.isMainFeatured ? "border-blue-500 shadow-md ring-1 ring-blue-500/20 bg-blue-50/10" : ""}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveItem(index, 'up')}
                                    disabled={index === 0}
                                    title="Przesuń film wyżej"
                                    aria-label={`Przesuń ${video.title} wyżej`}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveItem(index, 'down')}
                                    disabled={index === videos.length - 1}
                                    title="Przesuń film niżej"
                                    aria-label={`Przesuń ${video.title} niżej`}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="relative w-20 h-11 rounded overflow-hidden bg-muted border shrink-0">
                                {video.thumbnailUrl && <Image src={video.thumbnailUrl} alt="" fill className="object-cover" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground w-4">{index + 1}.</span>
                                    <h3 className="font-bold text-sm truncate">{video.title}</h3>
                                </div>
                                <div className="flex items-center gap-2 mt-1 ml-6">
                                    <Badge variant="outline" className="text-[8px] uppercase">{video.tier}</Badge>
                                    <Badge variant="secondary" className="text-[8px]">{video.status}</Badge>
                                    {video.isMainFeatured && <Badge className="bg-blue-600 text-[8px]"><Star className="h-2 w-2 mr-1 fill-current" /> HERO</Badge>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant={video.isMainFeatured ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 text-[9px] font-black uppercase tracking-tight"
                                    onClick={() => setAsHero(video)}
                                    disabled={video.isMainFeatured || video.status !== 'PUBLISHED' || video.tier !== 'PUBLIC'}
                                >
                                    {video.isMainFeatured ? "GŁÓWNY HERO" : "USTAW HERO"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={video.showInSidebar ? "text-blue-600" : "text-muted-foreground opacity-40"}
                                    onClick={() => toggleSidebar(video)}
                                    title={video.showInSidebar ? "Ukryj z sidebaru" : "Pokaż w sidebarze"}
                                >
                                    {video.showInSidebar ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      </main>
    </div>
  );
}
