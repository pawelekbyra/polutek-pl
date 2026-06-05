"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, ShieldCheck, ImageIcon, Video, Youtube, BarChart3, AlertCircle, Save } from "@/app/components/icons";
import { SUPPORTED_VIDEO_SOURCES, getVideoSourceInfo } from "@/lib/media/video-source";

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
  setFormData: (data: any) => void;
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
  const detectedVideoSource = formData.videoUrl ? getVideoSourceInfo(formData.videoUrl) : null;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border bg-card/95 p-5 shadow-sm md:flex-row md:items-start md:justify-between md:p-6">
          <div className="space-y-2">
            <Button type="button" variant="ghost" className="-ml-3 w-fit" onClick={onCancel}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do panelu admina
            </Button>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Panel Twórcy</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{formData.id ? "Edytuj film" : "Dodaj nowy film"}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Pełna strona zamiast ciasnego modala: szerokie pola, czytelne sekcje i zapis jako ostatni element formularza.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:items-center">
            {detectedVideoSource && (
              <Badge variant="outline" className="w-fit gap-2 rounded-full px-3 py-1.5 text-sm">
                {detectedVideoSource.kind === 'youtube' ? <Youtube className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                Wykryto: {detectedVideoSource.label}
              </Badge>
            )}
            <Button type="button" variant="outline" onClick={onCancel}>
              Panel admina
            </Button>
          </div>
        </div>

        {formError && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/15 p-4 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="rounded-3xl border bg-card p-5 shadow-sm md:p-6">
                <Tabs defaultValue="pl" className="w-full gap-0">
                  <div className="flex flex-col gap-4 border-b pb-4">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <Globe className="h-5 w-5 shrink-0" /> Treść i języki
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">Wybierz język krótkimi zakładkami, a tytuł, slug i opis edytuj w pełnej szerokości sekcji.</p>
                    </div>
                    <TabsList className="inline-flex h-auto w-fit max-w-full shrink-0 gap-1 self-start bg-muted/60 p-1">
                      <TabsTrigger value="pl" className="whitespace-nowrap px-3 py-2 text-xs sm:text-sm">Polski</TabsTrigger>
                      <TabsTrigger value="en" className="whitespace-nowrap px-3 py-2 text-xs sm:text-sm">Angielski</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="pl" className="mt-5 space-y-5">
                    <div className="grid grid-cols-1 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="title" className="text-sm font-bold">Tytuł filmu (PL)</Label>
                        <Input id="title" className="h-12 w-full text-base" placeholder="Np. Mój nowy film" value={formData.title} onChange={e => onTitleChange(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug" className="text-sm font-bold text-muted-foreground">Slug (URL)</Label>
                        <Input
                          id="slug"
                          className="h-11 w-full text-sm md:text-base"
                          placeholder="moj-nowy-film"
                          value={formData.slug}
                          onChange={e => onSlugChange(e.target.value)}
                          required
                        />
                        <p className="text-xs leading-relaxed text-muted-foreground">Adres filmu generowany z tytułu; możesz go poprawić ręcznie, używając małych liter, cyfr i myślników.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-bold">Opis (PL)</Label>
                      <Textarea id="description" className="min-h-40 text-base leading-7" placeholder="Szczegółowy opis filmu..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </TabsContent>
                  <TabsContent value="en" className="mt-5 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="titleEn" className="text-sm font-bold text-blue-600">Tytuł (EN)</Label>
                      <Input id="titleEn" className="h-12 w-full text-base" placeholder="My new video" value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descriptionEn" className="text-sm font-bold text-blue-600">Opis (EN)</Label>
                      <Textarea id="descriptionEn" className="min-h-40 w-full text-base leading-7" placeholder="Detailed video description..." value={formData.descriptionEn} onChange={e => setFormData({...formData, descriptionEn: e.target.value})} />
                    </div>
                  </TabsContent>
                </Tabs>
              </section>

              <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-muted/60 via-background to-background shadow-sm">
                <div className="border-b bg-background/70 p-5 md:p-6">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <ImageIcon className="h-5 w-5" /> Media i źródła filmu
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Wklej jeden link do filmu. System rozpozna YouTube, Vimeo, HLS, DASH albo bezpośredni plik wideo.</p>
                </div>
                <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px] md:p-6">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="videoUrl" className="text-sm font-bold">Link do filmu</Label>
                        {detectedVideoSource && <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">{detectedVideoSource.label}</Badge>}
                      </div>
                      <Input id="videoUrl" className="h-12 w-full text-base" placeholder="https://youtu.be/... albo https://cdn.example.com/video.m3u8" value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value.trim()})} required />
                      <p className="text-xs leading-relaxed text-muted-foreground">Dla plików R2/S3/Vercel Blob i własnych CDN host musi być dodany w konfiguracji <code className="rounded bg-muted px-1 py-0.5">ALLOWED_MEDIA_HOSTS</code>. YouTube i Vimeo są odtwarzane jako osadzone źródła.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-2">
                        <Label htmlFor="thumbnailUrl" className="text-sm font-bold">Miniaturka / poster</Label>
                        <Input id="thumbnailUrl" className="h-11 w-full" placeholder="/thumbnail.jpg lub https://..." value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value.trim()})} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration" className="text-sm font-bold">Czas trwania</Label>
                        <Input id="duration" className="h-11 w-full" placeholder="MM:SS" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <aside className="rounded-2xl border bg-background p-4 shadow-sm">
                    <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-blue-600" /> Obsługiwane formaty</h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {SUPPORTED_VIDEO_SOURCES.map((source) => (
                        <li key={source} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" /><span>{source}</span></li>
                      ))}
                    </ul>
                  </aside>
                </div>
              </section>
            </div>

            <aside className="space-y-6 2xl:sticky 2xl:top-20 2xl:self-start">
              <section className="space-y-4 rounded-3xl border bg-card p-5 shadow-sm md:p-6">
                <h2 className="flex items-center gap-2 border-b pb-3 text-lg font-semibold">
                  <ShieldCheck className="h-5 w-5" /> Widoczność i dostęp
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tier" className="text-sm font-bold">Poziom dostępu</Label>
                    <Select value={formData.tier} onValueChange={(v) => setFormData({...formData, tier: v || "PUBLIC"})}>
                      <SelectTrigger className="w-full h-11"><SelectValue placeholder="Wybierz poziom" /></SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value="PUBLIC">Publiczny (wszyscy)</SelectItem>
                        <SelectItem value="LOGGED_IN">Dla zalogowanych</SelectItem>
                        <SelectItem value="PATRON">Dla Patronów — wymaga statusu Patrona</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-bold">Status publikacji</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v || "PUBLISHED"})}>
                      <SelectTrigger className="w-full h-11"><SelectValue placeholder="Wybierz status" /></SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value="DRAFT">Szkic (DRAFT)</SelectItem>
                        <SelectItem value="PUBLISHED">Opublikowany</SelectItem>
                        <SelectItem value="UNLISTED">Niepubliczny</SelectItem>
                        <SelectItem value="ARCHIVED">Zarchiwizowany</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sidebarOrder" className="text-sm font-bold">Kolejność (1 = góra)</Label>
                    <Input id="sidebarOrder" type="number" value={formData.sidebarOrder} onChange={e => setFormData({...formData, sidebarOrder: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-start space-x-3 rounded-2xl border bg-muted/50 p-4">
                    <Checkbox id="isMainFeatured" checked={formData.isMainFeatured} onCheckedChange={(checked) => setFormData({...formData, isMainFeatured: !!checked})} />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="isMainFeatured" className="text-sm font-bold">Hero Video</Label>
                      <p className="text-xs leading-5 text-muted-foreground">Główny film na stronie (wymaga PUBLIC + PUBLISHED).</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 rounded-2xl border bg-muted/50 p-4">
                    <Checkbox id="showInSidebar" checked={formData.showInSidebar} onCheckedChange={(checked) => setFormData({...formData, showInSidebar: !!checked})} />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="showInSidebar" className="text-sm font-bold">Pokaż w sidebarze</Label>
                      <p className="text-xs leading-5 text-muted-foreground">Film będzie widoczny na liście bocznej kanału.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-3xl border bg-card p-5 shadow-sm md:p-6">
                <h2 className="flex items-center gap-2 border-b pb-3 text-lg font-semibold">
                  <BarChart3 className="h-5 w-5" /> Statystyki (override)
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 2xl:grid-cols-1">
                  <div className="space-y-2"><Label htmlFor="likes" className="text-sm">Polubienia</Label><Input id="likes" type="number" value={formData.likesCount} onChange={e => setFormData({...formData, likesCount: parseInt(e.target.value) || 0})} /></div>
                  <div className="space-y-2"><Label htmlFor="dislikes" className="text-sm">Dislajki</Label><Input id="dislikes" type="number" value={formData.dislikesCount} onChange={e => setFormData({...formData, dislikesCount: parseInt(e.target.value) || 0})} /></div>
                  <div className="space-y-2"><Label htmlFor="views" className="text-sm">Wyświetlenia</Label><Input id="views" type="number" value={formData.views} onChange={e => setFormData({...formData, views: parseInt(e.target.value) || 0})} /></div>
                </div>
              </section>
            </aside>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{formData.id ? "Zapisujesz zmiany w istniejącym filmie." : "Nowy film zostanie dodany do panelu po zapisaniu."}</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCancel} disabled={isSubmitting}>Anuluj</Button>
                <Button type="submit" className="flex-[2] sm:min-w-48" disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" /> {isSubmitting ? "Zapisywanie..." : (formData.id ? "Zapisz zmiany" : "Dodaj film")}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
