"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
    Video, Globe, Lock, ShieldCheck, BarChart3,
    MessageSquare, History, AlertTriangle,
    Play, Eye, Heart, Layout, FileVideo,
    CheckCircle2, XCircle, Archive, RotateCcw, Send,
    Edit, Settings
} from "@/app/components/icons";
import { logger } from "@/lib/logger";
import VideoPlayer from "@/app/components/VideoPlayer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import { useToast } from "@/app/hooks/useToast";
import { SafeAvatar } from "@/app/components/SafeAvatar";
import { AdminVideoDetailsSkeleton } from "@/components/skeletons/admin";
import { formatDate } from "../components/utils";
import { VideoAuditLog } from "../components/VideoAuditLog";
import { VideoDetailsPanel } from "../components/VideoDetailsPanel";
import { VideoUploadSection } from "../components/VideoUploadSection";
import { readAdminApiError } from "../components/api-error";
import { resolveInitialVideoDetailsTab, type VideoDetailsTab } from "./details-tab-state";
import { AdminNavigation } from "@/app/admin/components/AdminNavigation";
import { VideoSourcesPanel } from "../components/VideoSourcesPanel";

export default function VideoDetailsPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const [video, setVideo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<VideoDetailsTab>(() =>
        typeof window === "undefined"
            ? "summary"
            : resolveInitialVideoDetailsTab(window.location.search, window.location.hash)
    );
    const toast = useToast();

    const fetchVideo = useCallback(async () => {
      try {
        const res = await fetch(`/api/admin/videos/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setVideo(data);
        } else { setError("Nie udało się pobrać danych filmu."); }
      } catch (err) {
        logger.error("Failed to fetch video details", err);
        setError("Błąd połączenia z serwerem.");
      } finally { setIsLoading(false); }
    }, [params.id]);

    useEffect(() => { fetchVideo(); }, [fetchVideo]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab as VideoDetailsTab);
        if (typeof window === "undefined") return;

        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        url.hash = tab === "media" ? "media" : "";
        window.history.replaceState(null, "", url.toString());
    };

    const handleAction = async (action: string, extraBody: any = {}) => {
        try {
            const isFullUrl = action.startsWith('comments/');
            const url = isFullUrl ? `/api/admin/${action}` : `/api/admin/videos/${params.id}/actions`;
            const body = isFullUrl ? {} : { action, ...extraBody };
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.ok) { toast(`Akcja ${action} wykonana pomyślnie.`, 'success'); fetchVideo(); }
            else { const err = await res.json(); toast(`Błąd: ${readAdminApiError(err, 'Nieznany błąd')}`, 'error'); }
        } catch (err) { toast("Błąd połączenia.", 'error'); }
    };

    if (isLoading) return (<div className="min-h-screen bg-muted/20 text-foreground"><Navbar /><main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><AdminVideoDetailsSkeleton /></main></div>);
    if (error || !video) return (<div className="min-h-screen bg-muted/20 text-foreground"><Navbar /><main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-center py-20"><div className="text-destructive font-bold text-xl mb-4">{error || "Film nie znaleziony."}</div><Button asChild variant="outline"><Link href="/admin/videos">Wróć do listy</Link></Button></main></div>);

    return (
      <div className="min-h-screen bg-muted/20 text-foreground">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div className="flex flex-col gap-1">
                  <AdminNavigation backHref="/admin/videos" backLabel="Wróć do listy filmów" currentLabel={video.title} breadcrumbs={[{ href: "/admin/videos", label: "Filmy" }]} className="" />
                  <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold tracking-tight">{video.title}</h1>
                      <Badge variant={video.status === 'PUBLISHED' ? 'default' : 'outline'}>{video.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">ID: {video.id} | Slug: {video.slug}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild><Link href={`/watch/${video.slug}`} target="_blank"><Eye className="mr-2 h-4 w-4" /> Podgląd</Link></Button>
                  <Button variant="default" size="sm" asChild><Link href={`/admin/videos/${video.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edytuj dane</Link></Button>
                  {video.status !== 'PUBLISHED' && (<Button variant="default" size="sm" onClick={() => handleAction('publish')} className="bg-green-600 hover:bg-green-700"><Send className="mr-2 h-4 w-4" /> Publikuj</Button>)}
                  {video.status === 'PUBLISHED' && (<Button variant="outline" size="sm" onClick={() => handleAction('unpublish')}><XCircle className="mr-2 h-4 w-4" /> Cofnij publikację</Button>)}
                  {video.status !== 'ARCHIVED' && (<Button variant="destructive" size="sm" onClick={() => handleAction('archive')}><Archive className="mr-2 h-4 w-4" /> Archiwizuj</Button>)}
                  {video.status === 'ARCHIVED' && (<Button variant="outline" size="sm" onClick={() => handleAction('restore')}><RotateCcw className="mr-2 h-4 w-4" /> Przywróć</Button>)}
              </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-3/4 space-y-6">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="w-full justify-start bg-background border rounded-lg p-1 mb-6 h-auto flex-wrap">
                  <TabsTrigger value="summary" className="px-4 py-2 flex gap-2 items-center"><Layout className="h-4 w-4" /> Podsumowanie</TabsTrigger>
                  <TabsTrigger value="content" className="px-4 py-2 flex gap-2 items-center"><FileVideo className="h-4 w-4" /> Treść</TabsTrigger>
                  <TabsTrigger value="media" className="px-4 py-2 flex gap-2 items-center"><Video className="h-4 w-4" /> Media</TabsTrigger>
                  <TabsTrigger value="access" className="px-4 py-2 flex gap-2 items-center"><Lock className="h-4 w-4" /> Dostęp</TabsTrigger>
                  <TabsTrigger value="diagnostics" className="px-4 py-2 flex gap-2 items-center"><AlertTriangle className="h-4 w-4" /> Diagnostyka {video.diagnostics?.length > 0 && <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{video.diagnostics.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="comments" className="px-4 py-2 flex gap-2 items-center"><MessageSquare className="h-4 w-4" /> Komentarze</TabsTrigger>
                  <TabsTrigger value="stats" className="px-4 py-2 flex gap-2 items-center"><BarChart3 className="h-4 w-4" /> Statystyki</TabsTrigger>
                  <TabsTrigger value="audit" className="px-4 py-2 flex gap-2 items-center"><History className="h-4 w-4" /> Historia</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            <Card className="overflow-hidden border-0 shadow-sm">
                                <div className="aspect-video bg-black relative group">
                                    <PremiumWrapper videoId={video.id} requiredTier={video.tier}>
                                        <VideoPlayer video={video} />
                                    </PremiumWrapper>
                                </div>
                            </Card>

                            {video.status === 'DRAFT' && (!video.asset || video.asset.processingState !== 'READY') && (
                                <VideoUploadSection
                                  videoId={video.id}
                                  onUploadComplete={fetchVideo}
                                  initialAsset={video.asset}
                                />
                            )}
                        </div>
                        <Card className="shadow-sm">
                            <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Szybki stan</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between py-2 border-b"><span className="text-xs">Status</span><Badge variant={video.status === 'PUBLISHED' ? 'default' : 'outline'}>{video.status}</Badge></div>
                                <div className="flex justify-between py-2 border-b"><span className="text-xs">Widoczność</span><Badge variant="secondary" className="gap-1">{video.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{video.tier}</Badge></div>
                                <div className="flex justify-between py-2 border-b"><span className="text-xs">Hero Video</span>{video.isMainFeatured ? <Badge className="bg-blue-600">TAK</Badge> : <span className="text-xs opacity-50">Nie</span>}</div>
                                <div className="flex flex-col gap-2 py-2 border-b">
                                    <div className="flex justify-between items-center"><span className="text-xs">Sidebar</span><span className="text-xs font-medium">{video.showInSidebar ? `Widoczny (${video.sidebarOrder})` : 'Ukryty'}</span></div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => { const current = video.showInSidebar; fetch(`/api/admin/videos/${params.id}/actions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showInSidebar: !current }) }).then(res => { if (res.ok) fetchVideo(); }); }}>{video.showInSidebar ? 'Ukryj' : 'Pokaż'}</Button>
                                        <div className="flex items-center gap-1 flex-1">
                                            <input type="number" defaultValue={video.sidebarOrder} className="w-12 h-7 text-[10px] border rounded px-1" onBlur={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) { fetch(`/api/admin/videos/${params.id}/actions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sidebarOrder: val }) }).then(res => { if (res.ok) fetchVideo(); }); } }} />
                                            <span className="text-[9px] text-muted-foreground">Poz.</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between py-2"><span className="text-xs">Utworzono</span><span className="text-xs font-medium">{formatDate(video.createdAt)}</span></div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="content"><VideoDetailsPanel video={video} /></TabsContent>
                <TabsContent value="media" id="media" className="space-y-6">
                    {video.status === 'DRAFT' && (!video.asset || video.asset.processingState !== 'READY') && (
                        <VideoUploadSection
                          videoId={video.id}
                          onUploadComplete={fetchVideo}
                          initialAsset={video.asset}
                          publishAfterReady={video.publishAfterAssetReady}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            <VideoSourcesPanel
                              videoId={video.id}
                              videoTier={video.tier}
                              sources={video.assets || (video.asset ? [video.asset] : [])}
                              onRefresh={fetchVideo}
                            />

                            {video.videoUrl && !video.asset && (
                              <Card className="shadow-sm">
                                <CardHeader><CardTitle className="text-lg">Akcje media</CardTitle></CardHeader>
                                <CardContent>
                                  <Button variant="secondary" size="sm" onClick={() => handleAction('import-legacy-to-cloudflare', { publishAfterAssetReady: true })}>
                                    <Send className="mr-2 h-4 w-4" /> Importuj legacy URL do Cloudflare
                                  </Button>
                                </CardContent>
                              </Card>
                            )}
                        </div>

                        <div className="space-y-6">
                            <Card className="shadow-sm">
                                <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Automatyzacja</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-xs">Auto-publikacja</span>
                                        <Badge variant={video.publishAfterAssetReady ? "default" : "outline"}>
                                            {video.publishAfterAssetReady ? "WŁĄCZONA" : "WYŁĄCZONA"}
                                        </Badge>
                                    </div>
                                    {video.publishAfterAssetReady && (
                                        <div className="space-y-3">
                                            <div className="text-[10px] text-muted-foreground space-y-1">
                                                <p>Status: {video.publishAfterAssetReadyCompletedAt ? "ZAKOŃCZONO" : video.publishAfterAssetReadyError ? "BŁĄD" : "OCZEKIWANIE"}</p>
                                                {video.publishAfterAssetReadyCompletedAt && <p>Gotowe: {formatDate(video.publishAfterAssetReadyCompletedAt)}</p>}
                                            </div>
                                            {video.publishAfterAssetReadyError && (
                                                <div className="p-2 bg-red-50 border border-red-100 rounded text-red-800 text-[10px]">
                                                    <p className="font-bold">Błąd auto-publikacji:</p>
                                                    <p>{video.publishAfterAssetReadyError}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="rounded-lg bg-sky-50 p-3 text-[10px] text-sky-950">
                                        <p className="font-semibold mb-1">Jak to działa?</p>
                                        <p>Gdy zasób Cloudflare Stream osiągnie stan <strong>READY</strong>, backend automatycznie opublikuje film, jeśli ta opcja jest aktywna.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="access" className="space-y-6">
                  <Card className="shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Zarządzanie dostępem i publikacją</CardTitle></CardHeader>
                      <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4 border rounded-xl p-4">
                                  <h3 className="font-bold text-sm">Status publikacji</h3>
                                  <div className="space-y-2">
                                      <div className="flex justify-between items-center text-sm py-1 border-b"><span className="text-muted-foreground">Obecny status:</span><Badge>{video.status}</Badge></div>
                                      <div className="flex justify-between items-center text-sm py-1 border-b"><span className="text-muted-foreground">Data publikacji:</span><span className="font-medium">{formatDate(video.publishedAt)}</span></div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 pt-4"><Button variant="outline" size="sm" onClick={() => handleAction('publish')} disabled={video.status === 'PUBLISHED'}>Opublikuj teraz</Button><Button variant="outline" size="sm" onClick={() => handleAction('unpublish')} disabled={video.status === 'DRAFT'}>Cofnij do szkicu</Button><Button variant="outline" size="sm" onClick={() => handleAction('archive')} disabled={video.status === 'ARCHIVED'}>Archiwizuj</Button></div>
                              </div>
                              <div className="space-y-4 border rounded-xl p-4">
                                  <h3 className="font-bold text-sm">Poziom dostępu</h3>
                                  <div className="space-y-2"><div className="flex justify-between items-center text-sm py-1 border-b"><span className="text-muted-foreground">Wymagany poziom:</span><Badge variant="secondary" className="gap-1">{video.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{video.tier}</Badge></div></div>
                                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-4">Zmiana poziomu dostępu wpływa na to, kto może obejrzeć ten materiał. Poziom dostępu edytujesz w kanonicznym formularzu filmu.</p>
                                  <Button variant="outline" size="sm" asChild><Link href={`/admin/videos/${video.id}/edit`}><Edit className="mr-2 h-3 w-3" /> Przejdź do edycji dostępu</Link></Button>
                              </div>
                          </div>
                      </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="diagnostics">
                  <Card className="shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Analiza i Diagnostyka</CardTitle></CardHeader>
                      <CardContent>
                          {!video.diagnostics || video.diagnostics.length === 0 ? (
                              <div className="flex items-center gap-4 p-6 bg-green-50 text-green-700 rounded-xl border border-green-100"><div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><ShieldCheck className="h-6 w-6" /></div><div><p className="font-bold text-sm text-green-800">Brak wykrytych problemów</p><p className="text-xs opacity-80 mt-0.5">Wszystkie pola i metadane wyglądają na poprawne.</p></div></div>
                          ) : (
                              <div className="space-y-3">
                                  {video.diagnostics.map((d: any, idx: number) => (
                                      <div key={idx} className={`flex items-start gap-4 p-5 rounded-xl border-l-4 ${d.severity === 'ERROR' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-amber-50 border-amber-400 text-amber-800'}`}>
                                          <AlertTriangle className={`h-6 w-6 shrink-0 ${d.severity === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`} />
                                          <div className="flex-1"><div className="flex justify-between"><p className="font-bold text-sm">{d.message}</p><Badge variant={d.severity === 'ERROR' ? 'destructive' : 'outline'} className="text-[10px] h-5">{d.severity}</Badge></div>{d.field && <p className="text-[10px] opacity-70 mt-2 font-mono bg-white/50 w-fit px-1 rounded uppercase tracking-tighter">Pole: {d.field}</p>}</div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="comments" className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-lg">Komentarze</CardTitle><CardDescription>Ostatnie dyskusje pod tym filmem.</CardDescription></div><Badge variant="outline">{video._count?.comments || 0} komentarzy</Badge></CardHeader>
                        <CardContent>
                            {video.comments?.length > 0 ? (
                                <div className="space-y-4">
                                    {video.comments.map((comment: any) => (
                                        <div key={comment.id} className="p-4 rounded-lg border bg-muted/30">
                                            <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><SafeAvatar src={comment.author?.imageUrl} alt={comment.author?.name || "Avatar"} size={24} fallbackSeed={comment.author?.id} /><div className="flex flex-col"><span className="text-xs font-bold">{comment.author?.name || comment.author?.username || "Użytkownik"}</span><span className="text-[10px] opacity-50">{comment.author?.email}</span></div></div><div className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground">{formatDate(comment.createdAt)}</span><Badge variant="outline" className="text-[9px] h-4">{comment.status}</Badge></div></div>
                                            <p className="text-sm leading-relaxed mb-3">{comment.text || <span className="italic opacity-50">Treść usunięta</span>}</p>
                                            <div className="flex gap-2">{comment.status === 'VISIBLE' ? (<Button onClick={() => handleAction(`comments/${comment.id}/hide`)} variant="ghost" size="sm" className="h-7 text-[10px]">Ukryj</Button>) : (<Button onClick={() => handleAction(`comments/${comment.id}/restore`)} variant="ghost" size="sm" className="h-7 text-[10px]">Przywróć</Button>)}<Button onClick={() => handleAction(`comments/${comment.id}/delete`)} variant="ghost" size="sm" className="h-7 text-[10px] text-red-600">Usuń</Button><Button variant="ghost" size="sm" className="h-7 text-[10px]" asChild><Link href={`/watch/${video.slug}#comment-${comment.id}`} target="_blank">Pokaż w serwisie</Link></Button></div>
                                        </div>
                                    ))}
                                    <Button variant="ghost" className="w-full text-xs" asChild><Link href={`/admin/comments?videoId=${encodeURIComponent(video.id)}`}>Pokaż wszystkie w moderacji</Link></Button>
                                </div>
                            ) : (
                                <div className="py-12 text-center space-y-2 opacity-50"><MessageSquare className="h-10 w-10 mx-auto opacity-20" /><p className="text-sm italic">Brak komentarzy pod tym filmem.</p></div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><StatBlock label="Wyświetlenia" value={video.views} icon={<Eye className="h-4 w-4" />} /><StatBlock label="Sesje wideo" value={video._count?.playbackSessions || 0} icon={<Play className="h-4 w-4" />} /><StatBlock label="Polubienia" value={video.likesCount} icon={<Heart className="h-4 w-4" />} /><StatBlock label="Komentarze" value={video._count?.comments || 0} icon={<MessageSquare className="h-4 w-4" />} /></div>
                    <p className="text-xs text-muted-foreground italic">Rozszerzona analityka sesji będzie dodana w osobnym zakresie.</p>
                </TabsContent>

                <TabsContent value="audit"><VideoAuditLog logs={video.auditLogs} /></TabsContent>
              </Tabs>
            </div>

            <div className="lg:w-1/4 space-y-6">
              <Card className="shadow-sm border-0 bg-primary text-primary-foreground overflow-hidden relative"><div className="absolute top-0 right-0 p-4 opacity-10"><Settings className="h-20 w-20" /></div><CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider opacity-80">Zarządzanie</CardTitle></CardHeader><CardContent className="space-y-4 relative"><Button variant="secondary" className="w-full justify-start h-10 font-bold" onClick={() => handleAction('set-hero')} disabled={video.isMainFeatured}><CheckCircle2 className="mr-2 h-4 w-4" /> Ustaw jako HERO</Button><Button variant="secondary" className="w-full justify-start h-10 font-bold" asChild><Link href={`/admin/videos/${video.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edytuj dane filmu</Link></Button></CardContent></Card>
              <Card className="shadow-sm"><CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Kolejność w sidebarze</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Widoczny:</span><Badge variant={video.showInSidebar ? 'default' : 'outline'}>{video.showInSidebar ? 'TAK' : 'NIE'}</Badge></div><div className="flex justify-between items-center"><span className="text-xs text-muted-foreground">Pozycja:</span><span className="text-lg font-black italic">#{video.sidebarOrder}</span></div><Button variant="outline" className="w-full h-8 text-[10px]" asChild><Link href="/admin/videos/layout">Zmień kolejność hurtowo</Link></Button></CardContent></Card>
            </div>
          </div>
        </main>
      </div>
    );
}

function StatBlock({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
    return (<Card className="shadow-sm"><CardContent className="p-5 flex items-center gap-4"><div className="p-2.5 bg-primary/10 rounded-xl text-primary">{icon}</div><div><p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">{label}</p><p className="text-2xl font-black">{value.toLocaleString()}</p></div></CardContent></Card>);
}
