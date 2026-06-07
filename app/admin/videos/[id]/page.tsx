"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Video, Globe, Lock, ShieldCheck, BarChart3, MessageSquare, History, AlertTriangle, ExternalLink, Play, Eye, Heart } from "@/app/components/icons";
import { logger } from "@/lib/logger";
import Image from "next/image";
import VideoPlayer from "@/app/components/VideoPlayer";
import PremiumWrapper from "@/app/components/PremiumWrapper";

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function VideoDetailsPage({ params }: { params: { id: string } }) {
  const [video, setVideo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) return <div className="p-8 text-center">Ładowanie...</div>;
  if (error || !video) return <div className="p-8 text-center text-destructive">{error || "Film nie znaleziony."}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" asChild className="-ml-3">
              <Link href="/admin/videos"><ArrowLeft className="mr-2 h-4 w-4" /> Wróć do listy</Link>
            </Button>
            <div className="flex gap-2">
                <Button variant="outline" asChild>
                    <Link href={`/watch/${video.slug}`} target="_blank">
                        <Eye className="mr-2 h-4 w-4" /> Podgląd publiczny
                    </Link>
                </Button>
                <Button>Edytuj dane</Button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3 space-y-6">
            <Card className="overflow-hidden">
                <div className="aspect-video bg-black relative">
                   <PremiumWrapper videoId={video.id} requiredTier={video.tier}>
                       <VideoPlayer video={video} />
                   </PremiumWrapper>
                </div>
            </Card>

            <Tabs defaultValue="content" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 mb-6">
                <TabsTrigger value="content" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">Treść</TabsTrigger>
                <TabsTrigger value="diagnostics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
                    Diagnostyka {video.diagnostics.length > 0 && <Badge variant="destructive" className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{video.diagnostics.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="stats" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">Statystyki</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">Historia</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-6">
                <Card>
                    <CardHeader><CardTitle className="text-base">Informacje o filmie</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Tytuł (PL)</Label>
                            <div className="p-3 bg-muted rounded-md mt-1 font-medium">{video.title}</div>
                        </div>
                        {video.titleEn && (
                            <div>
                                <Label>Tytuł (EN)</Label>
                                <div className="p-3 bg-muted rounded-md mt-1 font-medium">{video.titleEn}</div>
                            </div>
                        )}
                        <div>
                            <Label>Opis (PL)</Label>
                            <div className="p-3 bg-muted rounded-md mt-1 text-sm whitespace-pre-wrap">{video.description || "Brak opisu."}</div>
                        </div>
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnostics">
                <Card>
                    <CardHeader><CardTitle className="text-base">Wykryte problemy</CardTitle></CardHeader>
                    <CardContent>
                        {video.diagnostics.length === 0 ? (
                            <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-xl border border-green-100">
                                <ShieldCheck className="h-5 w-5" />
                                <p className="font-medium text-sm">Nie wykryto żadnych problemów z tym filmem.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {video.diagnostics.map((d: any, idx: number) => (
                                    <div key={idx} className={`flex items-start gap-3 p-4 rounded-xl border ${d.severity === 'ERROR' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-bold text-sm">{d.message}</p>
                                            {d.field && <p className="text-xs opacity-70 mt-1 uppercase font-mono">Pole: {d.field}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stats">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <StatBlock label="Wyświetlenia (licznik)" value={video.views} icon={<Eye className="h-4 w-4" />} />
                      <StatBlock label="Sesje odtwarzania" value={video._count.playbackSessions} icon={<Play className="h-4 w-4" />} />
                      <StatBlock label="Polubienia" value={video.likesCount} icon={<Heart className="h-4 w-4" />} />
                      <StatBlock label="Komentarze" value={video._count.comments} icon={<MessageSquare className="h-4 w-4" />} />
                  </div>
              </TabsContent>

              <TabsContent value="audit">
                  <div className="space-y-3">
                      {video.auditLogs.map((log: any) => (
                          <div key={log.id} className="p-3 rounded-lg border text-xs bg-card">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold uppercase text-primary">{log.action}</span>
                                  <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                              </div>
                              <p className="text-muted-foreground">Aktor: {log.actorUserId || "SYSTEM"}</p>
                              {log.metadata && (
                                  <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-40">
                                      {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                              )}
                          </div>
                      ))}
                      {video.auditLogs.length === 0 && (
                          <p className="text-center py-10 text-muted-foreground italic">Brak historii dla tego filmu.</p>
                      )}
                  </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:w-1/3 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Status i Dostęp</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={video.status === 'PUBLISHED' ? 'default' : 'outline'}>{video.status}</Badge>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Poziom:</span>
                    <Badge variant="secondary" className="gap-1">
                        {video.tier === 'PUBLIC' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {video.tier}
                    </Badge>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Hero Video:</span>
                    {video.isMainFeatured ? <Badge className="bg-blue-600">TAK</Badge> : <span className="text-sm font-medium">Nie</span>}
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Sidebar:</span>
                    {video.showInSidebar ? <span className="text-sm font-medium">Widoczny ({video.sidebarOrder})</span> : <span className="text-sm text-muted-foreground">Ukryty</span>}
                </div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-sm">Szczegóły techniczne</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Video URL</Label>
                        <div className="text-[11px] bg-muted p-2 rounded break-all">{video.videoUrl}</div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Thumbnail URL</Label>
                        <div className="text-[11px] bg-muted p-2 rounded break-all">{video.thumbnailUrl}</div>
                    </div>
                    <div className="pt-2">
                        <p className="text-[10px] text-muted-foreground">ID: {video.id}</p>
                        <p className="text-[10px] text-muted-foreground">Slug: {video.slug}</p>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={`text-xs font-bold text-muted-foreground uppercase tracking-wider ${className}`}>{children}</span>;
}

function StatBlock({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value.toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
    );
}
