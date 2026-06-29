"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, ShieldCheck, ImageIcon, AlertCircle, Save, FileVideo, Send, RotateCcw, Youtube } from "@/app/components/icons";
import { CoverImageUpload } from "./CoverImageUpload";

export type CreateVideoSourceMode = "UPLOAD" | "EXISTING_CLOUDFLARE" | "YOUTUBE" | "VIMEO" | "NONE";

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
  externalSourceId?: string;
  onExternalSourceIdChange?: (value: string) => void;
  preferredProvider?: string;
  onPreferredProviderChange?: (value: string) => void;
  /** Current video tier — needed to gate YouTube/Vimeo options */
  currentTier?: string;
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
  onExistingCloudflareSourceChange,
  externalSourceId = "",
  onExternalSourceIdChange,
  preferredProvider = "CLOUDFLARE_STREAM",
  onPreferredProviderChange,
  currentTier,
}: VideoFormProps) {
  const isCreate = !formData.id;
  const wantsPublish = formData.status === "PUBLISHED";
  const isPatron = (currentTier || formData.tier) === "PATRON";

  function hasCreateSource(): boolean {
    if (createSourceMode === "UPLOAD") return Boolean(selectedVideoFile);
    if (createSourceMode === "EXISTING_CLOUDFLARE") return existingCloudflareSource.trim().length > 0;
    if (createSourceMode === "YOUTUBE" || createSourceMode === "VIMEO") return externalSourceId.trim().length > 0;
    if (createSourceMode === "NONE") return true;
    return false;
  }

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
            disabled={isSubmitting || !formData.title.trim() || !formData.slug.trim() || (isCreate && !hasCreateSource())}
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
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileVideo className="h-5 w-5" /> Źródła wideo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isCreate ? (
                <>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                    <p className="font-semibold">Wybierz źródło główne</p>
                    <p className="mt-1 text-xs">Pierwsze źródło stanie się primary. Kolejne źródła alternatywne możesz dodać po zapisie w zakładce Media.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Typ źródła</Label>
                    <Select value={createSourceMode} onValueChange={(value) => onCreateSourceModeChange?.(value as CreateVideoSourceMode)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPLOAD">Cloudflare Stream — upload pliku</SelectItem>
                        <SelectItem value="EXISTING_CLOUDFLARE">Cloudflare Stream — istniejący UID</SelectItem>
                        {!isPatron && <SelectItem value="YOUTUBE">YouTube — URL lub ID</SelectItem>}
                        {!isPatron && <SelectItem value="VIMEO">Vimeo — URL lub ID</SelectItem>}
                        <SelectItem value="NONE">Brak źródła — zapisz szkic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {createSourceMode === "UPLOAD" && (
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
                        <p className="text-xs text-muted-foreground">Można zapisać pusty szkic, ale publikacja wymaga pliku.</p>
                      )}
                    </div>
                  )}

                  {createSourceMode === "UPLOAD" && (
                    <div className="space-y-2">
                      <Label>Primary provider</Label>
                      <Select value={preferredProvider} onValueChange={onPreferredProviderChange} disabled={isSubmitting}>
                        <SelectTrigger><SelectValue placeholder="Wybierz provider..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLOUDFLARE_STREAM">Cloudflare Stream</SelectItem>
                          <SelectItem value="MUX">Mux</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Plik trafi na R2, następnie zostanie zmirrorowany na oba providery. Wybrany stanie się primary — z niego będzie serwowane wideo.
                      </p>
                    </div>
                  )}

                  {createSourceMode === "EXISTING_CLOUDFLARE" && (
                    <div className="space-y-2">
                      <Label htmlFor="existingCloudflareSource">Cloudflare Stream UID albo adres</Label>
                      <Input
                        id="existingCloudflareSource"
                        value={existingCloudflareSource}
                        onChange={(event) => onExistingCloudflareSourceChange?.(event.target.value)}
                        placeholder="np. 31c9291ab41fac05471db4e73aa11717"
                        disabled={isSubmitting}
                      />
                      {existingCloudflareSource.trim() && (
                        <p className="text-xs text-muted-foreground">Po zapisie sprawdzę status assetu w Cloudflare i opublikuję tylko jeśli jest READY.</p>
                      )}
                    </div>
                  )}

                  {createSourceMode === "YOUTUBE" && (
                    <div className="space-y-2">
                      <Label htmlFor="externalSourceId" className="flex items-center gap-1"><Youtube className="h-3 w-3 text-red-600" />YouTube URL lub ID</Label>
                      <Input
                        id="externalSourceId"
                        value={externalSourceId}
                        onChange={(event) => onExternalSourceIdChange?.(event.target.value)}
                        placeholder="np. https://youtube.com/watch?v=abc lub abc123"
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {createSourceMode === "VIMEO" && (
                    <div className="space-y-2">
                      <Label htmlFor="externalSourceId" className="flex items-center gap-1"><span className="text-sky-700 font-bold text-sm">◈</span>Vimeo URL lub ID</Label>
                      <Input
                        id="externalSourceId"
                        value={externalSourceId}
                        onChange={(event) => onExternalSourceIdChange?.(event.target.value)}
                        placeholder="np. https://vimeo.com/123456789 lub 123456789"
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {createSourceMode === "NONE" && (
                    <p className="text-xs text-muted-foreground rounded-lg border border-amber-200 bg-amber-50 p-3">
                      Film zostanie zapisany jako szkic bez źródła. Źródła możesz dodać później w szczegółach filmu.
                    </p>
                  )}

                  {isPatron && (createSourceMode === "YOUTUBE" || createSourceMode === "VIMEO") && (
                    <p className="text-xs text-destructive">YouTube i Vimeo niedostępne dla tieru PATRON — brak bezpiecznego prywatnego playbacku.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Upload i zarządzanie źródłami są dostępne w zakładce Media szczegółów filmu.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Miniatura</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <CoverImageUpload
                videoId={formData.id}
                initialUrl={formData.thumbnailUrl}
                onUploadSuccess={(url) => setFormData(prev => ({ ...prev, thumbnailUrl: url }))}
              />

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="thumbnailUrl" className="text-xs text-muted-foreground">Ręczny URL miniatury (opcjonalnie/legacy)</Label>
                <div className="flex gap-2">
                  <Input
                    id="thumbnailUrl"
                    value={formData.thumbnailUrl}
                    onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})}
                    placeholder="Puste pole użyje domyślnego /logo.png"
                    disabled={isSubmitting}
                    className="text-xs h-8"
                  />
                  {formData.thumbnailUrl && formData.thumbnailUrl !== "/logo.png" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFormData({...formData, thumbnailUrl: "/logo.png"})}
                      title="Resetuj do domyślnej"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
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
              <div className="space-y-3 pt-3">
                <Label>{isCreate ? "Docelowy stan po zapisie" : "Status"}</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v || "DRAFT"})} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Szkic</SelectItem>
                    {isCreate ? (
                      <SelectItem value="PUBLISHED">Publiczny po gotowym uploadzie</SelectItem>
                    ) : null}
                    {!isCreate && formData.status === "PUBLISHED" ? (
                      <SelectItem value="PUBLISHED">Opublikowany</SelectItem>
                    ) : null}
                    {!isCreate ? (
                      <SelectItem value="ARCHIVED">Zarchiwizowany</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isCreate
                    ? "Serwer nadal tworzy rekord jako DRAFT; publikacja następuje dopiero po udanym uploadzie, przetworzeniu i backendowej walidacji."
                    : "W tym formularzu możesz cofnąć film do szkicu albo go zarchiwizować. Publikacja pozostaje osobną akcją w szczegółach filmu, aby zachować backendowe blokady publikacji i walidację assetu."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
