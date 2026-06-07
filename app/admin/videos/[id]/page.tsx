"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft, Video, Globe, Lock, ShieldCheck, BarChart3,
    MessageSquare, History, AlertTriangle, ExternalLink,
    Play, Eye, Heart, Layout, Settings, FileVideo,
    CheckCircle2, XCircle, Archive, RotateCcw, Send,
    Edit
} from "@/app/components/icons";
import { logger } from "@/lib/logger";
import Image from "next/image";
import VideoPlayer from "@/app/components/VideoPlayer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import { useToast } from "@/app/hooks/useToast";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function VideoDetailsPage({ params }: { params: { id: string } }) {
  const [video, setVideo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const fetchVideo = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/videos/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setVideo(data);
      } else {
        setError("Nie udało się pobrać danych filmu.");
      }
    } catch (err) {
      logger.error("Failed to fetch video details", err);
      setError("Błąd połączenia z serwerem.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  const handleAction = async (action: string) => {
      try {
          const res = await fetch(`/api/admin/videos/${params.id}/actions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action })
          });
          if (res.ok) {
              toast(`Akcja ${action} wykonana pomyślnie.`, 'success');
              fetchVideo();
          } else {
              const err = await res.json();
              toast(`Błąd: ${err.error}`, 'error');
          }
      } catch (err) {
          toast("Błąd połączenia.", 'error');
      }
  };

  if (isLoading) return <div className="p-8 text-center italic text-muted-foreground animate-pulse">Ładowanie danych filmu...</div>;
  if (error || !video) return <div className="p-8 text-center text-destructive font-bold">{error || "Film nie znaleziony."}</div>;

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex flex-col gap-1">
                <Button variant="ghost" asChild className="-ml-3 w-fit h-8 px-2 text-muted-foreground hover:text-foreground">
                  <Link href="/admin/videos"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do listy</Link>
                </Button>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">{video.title}</h1>
                    <Badge variant={video.status === 'PUBLISHED' ? 'default' : 'outline'}>{video.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono">ID: {video.id} | Slug: {video.slug}</div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/watch/${video.slug}`} target="_blank">
                        <Eye className="mr-2 h-4 w-4" /> Podgląd
                    </Link>
                </Button>

                {video.status !== 'PUBLISHED' && (
                    <Button variant="default" size="sm" onClick={() => handleAction('publish')} className="bg-green-600 hover:bg-green-700">
                        <Send className="mr-2 h-4 w-4" /> Publikuj
                    </Button>
                )}
                {video.status === 'PUBLISHED' && (
                    <Button variant="outline" size="sm" onClick={() => handleAction('unpublish')}>
                        <XCircle className="mr-2 h-4 w-4" /> Cofnij publikację
                    </Button>
                )}
                {video.status !== 'ARCHIVED' && (
                    <Button variant="destructive" size="sm" onClick={() => handleAction('archive')}>
                        <Archive className="mr-2 h-4 w-4" /> Archiwizuj
                    </Button>
                )}
                {video.status === 'ARCHIVED' && (
                    <Button variant="outline" size="sm" onClick={() => handleAction('restore')}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Przywróć
                    </Button>
                )}
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-3/4 space-y-6">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-background border rounded-lg p-1 mb-6 h-auto flex-wrap">
                <TabsTrigger value="summary" className="px-4 py-2 flex gap-2 items-center"><Layout className="h-4 w-4" /> Podsumowanie</TabsTrigger>
                <TabsTrigger value="content" className="px-4 py-2 flex gap-2 items-center"><FileVideo className="h-4 w-4" /> Treść</TabsTrigger>
                <TabsTrigger value="media" className="px-4 py-2 flex gap-2 items-center"><Video className="h-4 w-4" /> Media</TabsTrigger>
                <TabsTrigger value="access" className="px-4 py-2 flex gap-2 items-center"><Lock className="h-4 w-4" /> Dostęp</TabsTrigger>
                <TabsTrigger value="diagnostics" className="px-4 py-2 flex gap-2 items-center">
                    <AlertTriangle className="h-4 w-4" /> Diagnostyka
                    {video.diagnostics?.length > 0 && <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{video.diagnostics.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="comments" className="px-4 py-2 flex gap-2 items-center"><MessageSquare className="h-4 w-4" /> Komentarze</TabsTrigger>
                <TabsTrigger value="stats" className="px-4 py-2 flex gap-2 items-center"><BarChart3 className="h-4 w-4" /> Statystyki</TabsTrigger>
                <TabsTrigger value="audit" className="px-4 py-2 flex gap-2 items-center"><History className="h-4 w-4" /> Historia</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="md:col-span-2 overflow-hidden border-0 shadow-sm">
                          <div className="aspect-video bg-black relative group">
                             <PremiumWrapper videoId={video.id} requiredTier={video.tier}>
                                 <VideoPlayer video={video} />
                             </PremiumWrapper>
                          </div>
                      </Card>
                      <Card className="shadow-sm">
                          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Szybki stan</CardTitle></CardHeader>
                          <CardContent className="space-y-4">
                              <div className="flex justify-between py-2 border-b">
                                  <span className="text-xs">Status</span>
                                  <Badge variant={video.status === 'PUBLISHED' ? 'default' : 'outline'}>{video.status}</Badge>
                              </div>
                              <div className="flex justify-between py-2 border-b">
                                  <span className="text-xs">Widoczność</span>
                                  <Badge variant="secondary" className="gap-1">
                                      {video.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                      {video.tier}
                                  </Badge>
                              </div>
                              <div className="flex justify-between py-2 border-b">
                                  <span className="text-xs">Hero Video</span>
                                  {video.isMainFeatured ? <Badge className="bg-blue-600">TAK</Badge> : <span className="text-xs opacity-50">Nie</span>}
                              </div>
                              <div className="flex flex-col gap-2 py-2 border-b">
                                  <div className="flex justify-between items-center">
                                      <span className="text-xs">Sidebar</span>
                                      <span className="text-xs font-medium">{video.showInSidebar ? `Widoczny (${video.sidebarOrder})` : 'Ukryty'}</span>
                                  </div>
                                  <div className="flex gap-2">
                                      <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-[10px] flex-1"
                                          onClick={() => {
                                              const current = video.showInSidebar;
                                              fetch(`/api/admin/videos/${params.id}/actions`, {
                                                  method: 'PATCH',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ showInSidebar: !current })
                                              }).then(res => { if (res.ok) fetchVideo(); });
                                          }}
                                      >
                                          {video.showInSidebar ? 'Ukryj' : 'Pokaż'}
                                      </Button>
                                      <div className="flex items-center gap-1 flex-1">
                                          <input
                                              type="number"
                                              defaultValue={video.sidebarOrder}
                                              className="w-12 h-7 text-[10px] border rounded px-1"
                                              onBlur={(e) => {
                                                  const val = parseInt(e.target.value);
                                                  if (!isNaN(val)) {
                                                      fetch(`/api/admin/videos/${params.id}/actions`, {
                                                          method: 'PATCH',
                                                          headers: { 'Content-Type': 'application/json' },
                                                          body: JSON.stringify({ sidebarOrder: val })
                                                      }).then(res => { if (res.ok) fetchVideo(); });
                                                  }
                                              }}
                                          />
                                          <span className="text-[9px] text-muted-foreground">Poz.</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex justify-between py-2">
                                  <span className="text-xs">Utworzono</span>
                                  <span className="text-xs font-medium">{formatDate(video.createdAt)}</span>
                              </div>
                          </CardContent>
                      </Card>
                  </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-6">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Treść i opisy</CardTitle>
                        <Button variant="outline" size="sm" asChild><Link href={`/admin/videos`}>Edytuj w formularzu</Link></Button>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tytuł PL</Label>
                                    <div className="p-3 bg-muted/50 rounded-lg font-medium">{video.title}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Opis PL</Label>
                                    <div className="p-3 bg-muted/50 rounded-lg text-sm min-h-[100px] whitespace-pre-wrap leading-relaxed">{video.description || "Brak opisu."}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tytuł EN</Label>
                                    <div className="p-3 bg-muted/50 rounded-lg font-medium">{video.titleEn || "—"}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Opis EN</Label>
                                    <div className="p-3 bg-muted/50 rounded-lg text-sm min-h-[100px] whitespace-pre-wrap leading-relaxed">{video.descriptionEn || "—"}</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="media" className="space-y-6">
                  <Card className="shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Zasoby multimedialne</CardTitle></CardHeader>
                      <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="md:col-span-2 space-y-4">
                                  <div className="space-y-2">
                                      <Label className="text-xs font-bold uppercase text-muted-foreground">Video URL</Label>
                                      <div className="flex gap-2">
                                          <div className="flex-1 p-2 bg-muted/50 rounded text-xs font-mono break-all">{video.videoUrl}</div>
                                          <Button variant="ghost" size="icon" asChild><a href={video.videoUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <Label className="text-xs font-bold uppercase text-muted-foreground">Thumbnail URL</Label>
                                      <div className="flex gap-2">
                                          <div className="flex-1 p-2 bg-muted/50 rounded text-xs font-mono break-all">{video.thumbnailUrl}</div>
                                          <Button variant="ghost" size="icon" asChild><a href={video.thumbnailUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 pt-4">
                                      <div>
                                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dostawca</Label>
                                          <div className="text-sm font-medium uppercase">{video.asset?.provider || "External / Direct"}</div>
                                      </div>
                                      <div>
                                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Typ</Label>
                                          <div className="text-sm font-medium">{video.asset?.mimeType || "—"}</div>
                                      </div>
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <Label className="text-xs font-bold uppercase text-muted-foreground">Podgląd miniatury</Label>
                                  <div className="aspect-video bg-muted rounded-lg overflow-hidden border relative">
                                      {video.thumbnailUrl && <Image src={video.thumbnailUrl} alt="Thumbnail preview" fill className="object-cover" />}
                                  </div>
                              </div>
                          </div>
                      </CardContent>
                  </Card>
              </TabsContent>

              <TabsContent value="access" className="space-y-6">
                <Card className="shadow-sm">
                    <CardHeader><CardTitle className="text-lg">Zarządzanie dostępem i publikacją</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4 border rounded-xl p-4">
                                <h3 className="font-bold text-sm">Status publikacji</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm py-1 border-b">
                                        <span className="text-muted-foreground">Obecny status:</span>
                                        <Badge>{video.status}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm py-1 border-b">
                                        <span className="text-muted-foreground">Data publikacji:</span>
                                        <span className="font-medium">{formatDate(video.publishedAt)}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-4">
                                    <Button variant="outline" size="sm" onClick={() => handleAction('publish')} disabled={video.status === 'PUBLISHED'}>Opublikuj teraz</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleAction('unpublish')} disabled={video.status === 'DRAFT'}>Cofnij do szkicu</Button>
                                    <Button variant="outline" size="sm" onClick={() => handleAction('archive')} disabled={video.status === 'ARCHIVED'}>Archiwizuj</Button>
                                </div>
                            </div>
                            <div className="space-y-4 border rounded-xl p-4">
                                <h3 className="font-bold text-sm">Poziom dostępu</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm py-1 border-b">
                                        <span className="text-muted-foreground">Wymagany poziom:</span>
                                        <Badge variant="secondary" className="gap-1">
                                            {video.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                            {video.tier}
                                        </Badge>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed mt-4">
                                    Zmiana poziomu dostępu wpływa na to, kto może obejrzeć ten materiał.
                                    Aby zmienić poziom, przejdź do <Link href="/admin/videos" className="text-primary hover:underline">edytora danych</Link>.
                                </p>
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
                            <div className="flex items-center gap-4 p-6 bg-green-50 text-green-700 rounded-xl border border-green-100">
                                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-green-800">Brak wykrytych problemów</p>
                                    <p className="text-xs opacity-80 mt-0.5">Wszystkie pola i metadane wyglądają na poprawne.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {video.diagnostics.map((d: any, idx: number) => (
                                    <div key={idx} className={`flex items-start gap-4 p-5 rounded-xl border-l-4 ${d.severity === 'ERROR' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-amber-50 border-amber-400 text-amber-800'}`}>
                                        <AlertTriangle className={`h-6 w-6 shrink-0 ${d.severity === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`} />
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <p className="font-bold text-sm">{d.message}</p>
                                                <Badge variant={d.severity === 'ERROR' ? 'destructive' : 'outline'} className="text-[10px] h-5">{d.severity}</Badge>
                                            </div>
                                            {d.field && <p className="text-[10px] opacity-70 mt-2 font-mono bg-white/50 w-fit px-1 rounded uppercase tracking-tighter">Pole: {d.field}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="space-y-6">
                  <Card className="shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                              <CardTitle className="text-lg">Komentarze</CardTitle>
                              <CardDescription>Ostatnie dyskusje pod tym filmem.</CardDescription>
                          </div>
                          <Badge variant="outline">{video._count?.comments || 0} komentarzy</Badge>
                      </CardHeader>
                      <CardContent>
                          {video.comments?.length > 0 ? (
                              <div className="space-y-4">
                                  {video.comments.map((comment: any) => (
                                      <div key={comment.id} className="p-4 rounded-lg border bg-muted/30">
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="flex items-center gap-2">
                                                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                                                      {comment.author?.email?.[0]?.toUpperCase()}
                                                  </div>
                                                  <span className="text-xs font-bold">{comment.author?.email}</span>
                                              </div>
                                              <span className="text-[10px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
                                          </div>
                                          <p className="text-sm leading-relaxed">{comment.text}</p>
                                      </div>
                                  ))}
                                  <Button variant="ghost" className="w-full text-xs text-muted-foreground italic">Pokaż wszystkie (Moderacja wkrótce)</Button>
                              </div>
                          ) : (
                              <div className="py-12 text-center space-y-2 opacity-50">
                                  <MessageSquare className="h-10 w-10 mx-auto opacity-20" />
                                  <p className="text-sm italic">Brak komentarzy pod tym filmem.</p>
                              </div>
                          )}
                      </CardContent>
                  </Card>
              </TabsContent>

              <TabsContent value="stats" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatBlock label="Wyświetlenia" value={video.views} icon={<Eye className="h-4 w-4" />} />
                      <StatBlock label="Sesje wideo" value={video._count?.playbackSessions || 0} icon={<Play className="h-4 w-4" />} />
                      <StatBlock label="Polubienia" value={video.likesCount} icon={<Heart className="h-4 w-4" />} />
                      <StatBlock label="Komentarze" value={video._count?.comments || 0} icon={<MessageSquare className="h-4 w-4" />} />
                  </div>
                  <Card className="shadow-sm">
                      <CardHeader><CardTitle className="text-sm font-bold uppercase">Głęboka analiza sesji</CardTitle></CardHeader>
                      <CardContent className="h-40 flex items-center justify-center text-muted-foreground text-xs italic">
                          Wykresy i analityka czasowa w przygotowaniu.
                      </CardContent>
                  </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-6">
                  <Card className="shadow-sm">
                    <CardHeader><CardTitle className="text-lg">Dziennik zdarzeń</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                          {video.auditLogs?.map((log: any) => (
                              <div key={log.id} className="p-4 rounded-xl border text-xs bg-muted/20 hover:bg-muted/40 transition-colors">
                                  <div className="flex justify-between items-center mb-2">
                                      <div className="flex items-center gap-2">
                                          <Badge className="font-mono text-[10px] uppercase">{log.action}</Badge>
                                          <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                                      </div>
                                      <span className="text-[10px] font-semibold text-primary">{log.actorUserId || "SYSTEM"}</span>
                                  </div>
                                  {log.metadata && (
                                      <pre className="mt-3 p-3 bg-black/5 rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap max-h-40 font-mono leading-relaxed">
                                          {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                  )}
                              </div>
                          ))}
                          {!video.auditLogs || video.auditLogs.length === 0 && (
                              <div className="py-12 text-center text-muted-foreground italic text-sm">Brak zapisanej historii dla tego filmu.</div>
                          )}
                      </div>
                    </CardContent>
                  </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:w-1/4 space-y-6">
            <Card className="shadow-sm border-0 bg-primary text-primary-foreground overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Settings className="h-20 w-20" /></div>
                <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider opacity-80">Zarządzanie</CardTitle></CardHeader>
                <CardContent className="space-y-4 relative">
                    <Button variant="secondary" className="w-full justify-start h-10 font-bold" onClick={() => handleAction('set-hero')} disabled={video.isMainFeatured}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Ustaw jako HERO
                    </Button>
                    <Button variant="secondary" className="w-full justify-start h-10 font-bold" asChild>
                        <Link href="/admin/videos"><Edit className="mr-2 h-4 w-4" /> Pełna edycja</Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Kolejność w sidebarze</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Widoczny:</span>
                        <Badge variant={video.showInSidebar ? 'default' : 'outline'}>{video.showInSidebar ? 'TAK' : 'NIE'}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Pozycja:</span>
                        <span className="text-lg font-black italic">#{video.sidebarOrder}</span>
                    </div>
                    <Button variant="outline" className="w-full h-8 text-[10px]" asChild>
                        <Link href="/admin/videos/layout">Zmień kolejność hurtowo</Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-dashed">
                <CardHeader><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Diagnostyka URL</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 bg-muted rounded text-[10px] font-mono break-all leading-relaxed">
                        {video.videoUrl}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold uppercase">
                        <CheckCircle2 className="h-3 w-3" /> URL jest dostępny
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBlock({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
    return (
        <Card className="shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">{icon}</div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">{label}</p>
                    <p className="text-2xl font-black">{value.toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
    );
}
