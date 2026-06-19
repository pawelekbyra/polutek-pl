"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, ShieldCheck, ImageIcon, Video, Youtube, BarChart3, AlertCircle, Save, RotateCcw, Play, Eye, AlertTriangle } from "@/app/components/icons";
import { SUPPORTED_VIDEO_SOURCES, getVideoSourceInfo } from "@/lib/media/video-source";
import VideoPlayer from "@/app/components/VideoPlayer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import type { PublicVideoDTO } from "@/app/types/video";
import type { AccessTierDto } from "@/lib/services/comments/comment.dto";

interface VideoFormData {
  id: string;
  title: string;
  titleEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  tier: string;
  status: string;
  likesCount: number;
  dislikesCount: number;
  views: number;
  isMainFeatured: boolean;
  showInSidebar: boolean;
  sidebarOrder: number;
}

interface VideoFormProps {
  formData: VideoFormData;
  setFormData: (data: VideoFormData | ((prev: VideoFormData) => VideoFormData)) => void;
  formError: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTitleChange: (val: string) => void;
  onSlugChange: (val: string) => void;
  slugify: (text: string) => string;
  className?: string;
}

type Diagnostic = {
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
};

export function VideoForm({
  formData,
  setFormData,
  formError,
  isSubmitting,
  onCancel,
  onSubmit,
  onTitleChange,
  onSlugChange,
  slugify,
  className
}: VideoFormProps) {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  useEffect(() => {
    const runDiagnostics = () => {
        const issues: Diagnostic[] = [];
        if (!formData.title) issues.push({ severity: "ERROR", message: "Brak tytułu PL." });
        if (!formData.videoUrl && !formData.id) issues.push({ severity: "INFO", message: "Cloudflare Stream dodasz po utworzeniu szkicu." });
        if (!formData.thumbnailUrl) issues.push({ severity: "INFO", message: "Brak miniatury — szkic użyje domyślnego placeholdera." });
        if (formData.isMainFeatured && formData.tier !== 'PUBLIC') issues.push({ severity: "ERROR", message: "Hero musi być publiczne." });
        setDiagnostics(issues);
    };
    runDiagnostics();
  }, [formData]);

  const detectedSource = useMemo(() => formData.videoUrl ? getVideoSourceInfo(formData.videoUrl) : null, [formData.videoUrl]);
  const previewVideo = useMemo<PublicVideoDTO>(() => ({
    id: formData.id || "preview",
    creatorId: "admin-preview",
    title: formData.title || "Podgląd szkicu",
    titleEn: formData.titleEn || null,
    slug: formData.slug || "preview",
    description: formData.description || null,
    descriptionEn: formData.descriptionEn || null,
    thumbnailUrl: formData.thumbnailUrl || "/logo.png",
    duration: formData.duration || null,
    tier: formData.tier as PublicVideoDTO["tier"],
    status: formData.status as PublicVideoDTO["status"],
    views: formData.views,
    likesCount: formData.likesCount,
    dislikesCount: formData.dislikesCount,
    isMainFeatured: formData.isMainFeatured,
    sidebarOrder: formData.sidebarOrder
  }), [formData]);

  return (
    <div className={cn("max-w-7xl mx-auto p-4 md:p-8 space-y-8", className)}>
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 gap-4">
          <div className="space-y-1">
            <Button variant="ghost" onClick={onCancel} className="-ml-3 mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" /> Wróć
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{formData.id ? "Edycja filmu" : "Nowy szkic Cloudflare"}</h1>
            <p className="text-sm text-muted-foreground">Zarządzaj treścią, mediami i dostępem do materiału. Nowe filmy startują jako bezpieczne szkice Cloudflare-first.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Anuluj</Button>
             <Button onClick={onSubmit} disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> {isSubmitting ? "Zapisywanie..." : (formData.id ? "Zapisz zmiany" : "Utwórz szkic Cloudflare")}
             </Button>
          </div>
        </header>

        {formError && (
          <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Content Section */}
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5" /> Treść i opisy</CardTitle></CardHeader>
                    <CardContent>
                        <Tabs defaultValue="pl">
                            <TabsList className="mb-4">
                                <TabsTrigger value="pl">Polski</TabsTrigger>
                                <TabsTrigger value="en">Angielski</TabsTrigger>
                            </TabsList>
                            <TabsContent value="pl" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Tytuł (PL)</Label>
                                    <Input id="title" value={formData.title} onChange={e => onTitleChange(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slug">Slug (URL)</Label>
                                    <Input id="slug" value={formData.slug} onChange={e => onSlugChange(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Opis (PL)</Label>
                                    <Textarea id="description" className="min-h-[150px]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                                </div>
                            </TabsContent>
                            <TabsContent value="en" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="titleEn">Tytuł (EN)</Label>
                                    <Input id="titleEn" value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="descriptionEn">Opis (EN)</Label>
                                    <Textarea id="descriptionEn" className="min-h-[150px]" value={formData.descriptionEn} onChange={e => setFormData({...formData, descriptionEn: e.target.value})} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Media Section */}
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Media</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                            <div className="mb-3 flex items-center gap-2 font-semibold">
                                <Video className="h-5 w-5" />
                                Ścieżka główna: Cloudflare Stream
                            </div>
                            <ol className="list-decimal space-y-1 pl-5">
                                <li>Zapisz film jako szkic.</li>
                                <li>Otwórz stronę szczegółów i mediów filmu.</li>
                                <li>Wygeneruj Cloudflare upload URL albo podepnij istniejący Cloudflare UID.</li>
                                <li>Synchronizuj status providera do momentu READY.</li>
                            </ol>
                            <p className="mt-3 text-xs text-sky-800">Ten formularz nie oznacza assetu jako READY i nie tworzy publicznego playbacku.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="videoUrl" className="flex items-center gap-2">
                                        Legacy / Migracja only
                                        <Badge variant="outline" className="text-[10px] uppercase bg-amber-50 text-amber-700 border-amber-200">Legacy / Migracja</Badge>
                                    </Label>
                                    <Input id="videoUrl" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} />
                                    {detectedSource && <Badge variant="secondary" className="mt-1">Wykryto: {detectedSource.label}</Badge>}
                                    <p className="text-[10px] text-muted-foreground italic mt-1">Uwaga: videoUrl jest wyłącznie ścieżką legacy/migracji. Launch path to Cloudflare Stream w panelu szczegółów filmu.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="thumbnailUrl">URL Miniatury (opcjonalnie)</Label>
                                    <Input id="thumbnailUrl" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} placeholder="Puste pole użyje domyślnego /logo.png" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="duration">Czas trwania (MM:SS)</Label>
                                    <Input id="duration" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <Label>Podgląd</Label>
                                <div className="aspect-video bg-black rounded-lg overflow-hidden border relative">
                                    {formData.videoUrl ? (
                                        <div className="h-full w-full">
                                            <PremiumWrapper videoId={formData.id || "preview"} requiredTier={formData.tier as AccessTierDto}>
                                                <VideoPlayer video={previewVideo} />
                                            </PremiumWrapper>
                                        </div>
                                    ) : (
                                        <div className="flex h-full items-center justify-center p-6 text-center text-xs italic text-muted-foreground">
                                            Główna ścieżka launch to Cloudflare Stream po utworzeniu szkicu. Zapisz szkic, a następnie dodaj upload URL lub Cloudflare UID na stronie szczegółów/mediów.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-8">
                {/* Publication & Access */}
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Status i Dostęp</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Poziom dostępu</Label>
                            <Select value={formData.tier} onValueChange={v => setFormData({...formData, tier: v || 'PUBLIC'})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PUBLIC">Publiczny</SelectItem>
                                    <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
                                    <SelectItem value="PATRON">Patroni</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status publikacji</Label>
                            <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v || 'DRAFT'})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DRAFT">Szkic</SelectItem>
                                    <SelectItem value="PUBLISHED">Opublikowany</SelectItem>
                                    <SelectItem value="UNLISTED">Niepubliczny</SelectItem>
                                    <SelectItem value="ARCHIVED">Zarchiwizowany</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <hr className="my-4" />

                        <div className="flex items-center gap-2">
                            <Checkbox id="isMainFeatured" checked={formData.isMainFeatured} onCheckedChange={v => setFormData({...formData, isMainFeatured: !!v})} />
                            <Label htmlFor="isMainFeatured" className="font-medium">Główny film (Hero)</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="showInSidebar" checked={formData.showInSidebar} onCheckedChange={v => setFormData({...formData, showInSidebar: !!v})} />
                            <Label htmlFor="showInSidebar" className="font-medium">Pokaż w sidebar</Label>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sidebarOrder">Kolejność w sidebar</Label>
                            <Input id="sidebarOrder" type="number" value={formData.sidebarOrder} onChange={e => setFormData({...formData, sidebarOrder: parseInt(e.target.value) || 0})} />
                        </div>
                    </CardContent>
                </Card>

                {/* Diagnostics */}
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Diagnostyka</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {diagnostics.length === 0 ? (
                            <div className="text-sm text-muted-foreground italic flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-600" /> Brak problemów.</div>
                        ) : diagnostics.map((d, i) => (
                            <div key={i} className={cn(
                                "p-3 rounded-lg text-xs border flex gap-2",
                                d.severity === 'ERROR' ? "bg-red-50 text-red-800 border-red-200" : d.severity === 'WARNING' ? "bg-yellow-50 text-yellow-800 border-yellow-200" : "bg-blue-50 text-blue-800 border-blue-200"
                            )}>
                                <AlertCircle className="h-4 w-4 shrink-0" /> {d.message}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
