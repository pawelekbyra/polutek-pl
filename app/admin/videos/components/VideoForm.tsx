"use client";

import { useEffect, useState, useMemo } from "react";
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
}

export function VideoForm({
  formData,
  setFormData,
  formError,
  isSubmitting,
  onCancel,
  onSubmit,
  onTitleChange,
  onSlugChange,
  slugify
}: VideoFormProps) {
  const [diagnostics, setDiagnostics] = useState<any[]>([]);

  useEffect(() => {
    const runDiagnostics = () => {
        const issues = [];
        if (!formData.title) issues.push({ severity: "ERROR", message: "Brak tytułu PL." });
        if (!formData.videoUrl) issues.push({ severity: "ERROR", message: "Brak URL wideo." });
        if (!formData.thumbnailUrl) issues.push({ severity: "WARNING", message: "Brak miniatury." });
        if (formData.isMainFeatured && formData.tier !== 'PUBLIC') issues.push({ severity: "ERROR", message: "Hero musi być publiczne." });
        setDiagnostics(issues);
    };
    runDiagnostics();
  }, [formData]);

  const detectedSource = useMemo(() => formData.videoUrl ? getVideoSourceInfo(formData.videoUrl) : null, [formData.videoUrl]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 gap-4">
          <div className="space-y-1">
            <Button variant="ghost" onClick={onCancel} className="-ml-3 mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" /> Wróć
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{formData.id ? "Edycja filmu" : "Nowy Film"}</h1>
            <p className="text-sm text-muted-foreground">Zarządzaj treścią, mediami i dostępem do materiału.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Anuluj</Button>
             <Button onClick={onSubmit} disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> {isSubmitting ? "Zapisywanie..." : "Zapisz zmiany"}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="videoUrl">URL Wideo</Label>
                                    <Input id="videoUrl" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} required />
                                    {detectedSource && <Badge variant="secondary" className="mt-1">Wykryto: {detectedSource.label}</Badge>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="thumbnailUrl">URL Miniatury</Label>
                                    <Input id="thumbnailUrl" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} required />
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
                                            <PremiumWrapper videoId={formData.id || "preview"} requiredTier={formData.tier as any}>
                                                <VideoPlayer video={formData as any} />
                                            </PremiumWrapper>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-xs italic">Brak URL wideo</div>
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
                            <Label htmlFor="showInSidebar" className="font-medium">Pokaż w sidebarze</Label>
                        </div>
                        <div className="space-y-2 pt-2">
                            <Label htmlFor="sidebarOrder">Kolejność w sidebarze</Label>
                            <Input id="sidebarOrder" type="number" value={formData.sidebarOrder} onChange={e => setFormData({...formData, sidebarOrder: parseInt(e.target.value) || 0})} />
                        </div>
                    </CardContent>
                </Card>

                {/* Diagnostics */}
                {diagnostics.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/30">
                        <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" /> Diagnostyka</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {diagnostics.map((d, i) => (
                                <div key={i} className={`text-xs flex gap-2 ${d.severity === 'ERROR' ? 'text-red-700' : 'text-amber-700'}`}>
                                    <span>•</span> {d.message}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Stats Override */}
                <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Statystyki (Override)</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px]">Polubienia</Label>
                                <Input type="number" value={formData.likesCount} onChange={e => setFormData({...formData, likesCount: parseInt(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px]">Wyświetlenia</Label>
                                <Input type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Uwaga: Zmiana tych wartości wpływa na licznik widoczny dla użytkowników.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
