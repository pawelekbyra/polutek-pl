"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, ShieldCheck, ImageIcon, AlertCircle, Save, FileVideo, Send } from "@/app/components/icons";

export type CreateVideoSourceMode = "UPLOAD" | "EXISTING_CLOUDFLARE";

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
  selectedVideoFile?: File | null;
  onVideoFileChange?: (file: File | null) => void;
  createSourceMode?: CreateVideoSourceMode;
  onCreateSourceModeChange?: (mode: CreateVideoSourceMode) => void;
  existingCloudflareSource?: string;
  onExistingCloudflareSourceChange?: (value: string) => void;
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
  className,
  selectedVideoFile,
  onVideoFileChange,
  createSourceMode = "UPLOAD",
  onCreateSourceModeChange,
  existingCloudflareSource = "",
  onExistingCloudflareSourceChange
}: VideoFormProps) {
  const isCreate = !formData.id;
  const wantsPublish = formData.status === "PUBLISHED";
  const hasCreateSource = createSourceMode === "UPLOAD" ? Boolean(selectedVideoFile) : existingCloudflareSource.trim().length > 0;

  return (
    <form onSubmit={onSubmit} className={cn("max-w-4xl mx-auto p-4 md:p-8 space-y-8", className)}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 gap-4">
        <div className="space-y-1">
          <Button type="button" variant="ghost" onClick={onCancel} className="-ml-3 mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Wróć
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{isCreate ? "Nowy film" : "Edycja filmu"}</h1>
          <p className="text-sm text-muted-foreground">
            {isCreate
              ? "Ustaw opis, tłumaczenia, dostęp i plik wideo w jednym miejscu. Zapisz jako szkic albo poproś o publikację po przetworzeniu Cloudflare."
              : "Edytuj metadane filmu. Media Cloudflare są zarządzane w szczegółach filmu."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Anuluj</Button>
          {isCreate ? (
            <Button
              type="submit"
              variant="outline"
              data-intent="DRAFT"
              disabled={isSubmitting || !formData.title.trim() || !formData.slug.trim()}
              onClick={() => setFormData({...formData, status: "DRAFT"})}
            >
              <Save className="mr-2 h-4 w-4" /> {isSubmitting && !wantsPublish ? "Zapisywanie..." : "Zapisz jako szkic"}
            </Button>
          ) : null}
          <Button
            type="submit"
            data-intent={isCreate ? "PUBLISHED" : "SAVE"}
            disabled={isSubmitting || !formData.title.trim() || !formData.slug.trim() || (isCreate && !hasCreateSource)}
            onClick={() => isCreate ? setFormData({...formData, status: "PUBLISHED"}) : undefined}
          >
            {isCreate ? <Send className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isSubmitting ? "Zapisywanie..." : (isCreate ? "Opublikuj po uploadzie" : "Zapisz zmiany")}
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
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5" /> Metadane</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tytuł (PL)</Label>
                <Input id="title" value={formData.title} onChange={e => onTitleChange(e.target.value)} required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" value={formData.slug} onChange={e => onSlugChange(e.target.value)} required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Opis (PL)</Label>
                <Textarea id="description" className="min-h-[150px]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="titleEn">Tytuł (EN, opcjonalnie)</Label>
                  <Input id="titleEn" value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Czas trwania (opcjonalnie)</Label>
                  <Input id="duration" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descriptionEn">Opis (EN, opcjonalnie)</Label>
                <Textarea id="descriptionEn" value={formData.descriptionEn} onChange={e => setFormData({...formData, descriptionEn: e.target.value})} disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileVideo className="h-5 w-5" /> Plik wideo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isCreate ? (
                <>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                    <p className="font-semibold">Jednoetapowe dodawanie</p>
                    <p className="mt-1 text-xs">Wybierz plik albo podaj istniejący Cloudflare Stream UID/adres. System utworzy techniczny szkic i — jeśli wybierzesz publikację — opublikuje dopiero po stanie READY.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Źródło Cloudflare</Label>
                    <Select value={createSourceMode} onValueChange={(value) => onCreateSourceModeChange?.(value as CreateVideoSourceMode)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPLOAD">Upload pliku do Cloudflare</SelectItem>
                        <SelectItem value="EXISTING_CLOUDFLARE">Istniejący Cloudflare Stream UID/adres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {createSourceMode === "UPLOAD" ? (
                    <div className="space-y-2">
                      <Label htmlFor="videoFile">Plik wideo {wantsPublish ? "(wymagany do publikacji)" : "(opcjonalny dla szkicu)"}</Label>
                      <Input
                        id="videoFile"
                        type="file"
                        accept="video/*"
                        disabled={isSubmitting}
                        onChange={(event) => onVideoFileChange?.(event.target.files?.[0] || null)}
                      />
                      {selectedVideoFile ? (
                        <p className="text-xs font-medium text-muted-foreground">Wybrano: {selectedVideoFile.name}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Możesz zapisać pusty szkic, ale publikacja wymaga pliku albo istniejącego assetu Cloudflare.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="existingCloudflareSource">Cloudflare Stream UID albo adres</Label>
                      <Input
                        id="existingCloudflareSource"
                        value={existingCloudflareSource}
                        onChange={(event) => onExistingCloudflareSourceChange?.(event.target.value)}
                        placeholder="np. 31c9291ab41fac05471db4e73aa11717 albo https://iframe.videodelivery.net/..."
                        disabled={isSubmitting}
                      />
                      {existingCloudflareSource.trim() ? (
                        <p className="text-xs font-medium text-muted-foreground">Po zapisie sprawdzę status assetu w Cloudflare i opublikuję tylko jeśli jest READY.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Podaj identyfikator/adres istniejącego assetu Cloudflare Stream.</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Upload i diagnostyka assetu są dostępne w zakładce Media szczegółów filmu.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Miniatura</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="thumbnailUrl">URL miniatury (opcjonalnie)</Label>
              <Input id="thumbnailUrl" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} placeholder="Puste pole użyje domyślnego /logo.png" disabled={isSubmitting} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Dostęp</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Label>Tier</Label>
              <Select value={formData.tier} onValueChange={v => setFormData({...formData, tier: v || "PUBLIC"})} disabled={isSubmitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Publiczny</SelectItem>
                  <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
                  <SelectItem value="PATRON">Patroni</SelectItem>
                </SelectContent>
              </Select>
              {isCreate ? (
                <div className="space-y-3 pt-3">
                  <Label>Docelowy stan po zapisie</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v || "DRAFT"})} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Szkic</SelectItem>
                      <SelectItem value="PUBLISHED">Publiczny po gotowym uploadzie</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Serwer nadal tworzy rekord jako DRAFT; publikacja następuje dopiero po udanym uploadzie, przetworzeniu i backendowej walidacji.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
