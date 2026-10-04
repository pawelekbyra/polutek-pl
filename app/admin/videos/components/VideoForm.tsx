"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, ShieldCheck, ImageIcon, AlertCircle, Save, FileVideo, Send, RotateCcw } from "@/app/components/icons";
import { CoverImageUpload } from "./CoverImageUpload";
import type { PublishMode } from "./video-utils";

/** The only source is our own pipeline: upload a file now, or save a draft and upload later. */
export type CreateVideoSourceMode = "UPLOAD" | "NONE";

interface VideoFormData {
  id: string;
  title: string;
  titleEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
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
  subtitleUrlPl: string;
  subtitleUrlEn: string;
  publishMode: PublishMode;
  premiereLocal: string;
  savedPremiereAt: string | null;
}

interface VideoFormProps {
  formData: VideoFormData;
  setFormData: (data: VideoFormData | ((prev: VideoFormData) => VideoFormData)) => void;
  formError: string | null;
  isSubmitting: boolean;
  isSourceLocked?: boolean;
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
  /** Extra cards under the right column (the edit page's "Cel zbiórki"). */
  sidebarExtra?: React.ReactNode;
}

export function VideoForm({
  formData,
  setFormData,
  formError,
  isSubmitting,
  isSourceLocked = false,
  onCancel,
  onSubmit,
  onTitleChange,
  onSlugChange,
  className,
  selectedVideoFile,
  onVideoFileChange,
  createSourceMode = "UPLOAD",
  onCreateSourceModeChange,
  sidebarExtra,
}: VideoFormProps) {
  const isCreate = !formData.id;
  const wantsPublish = formData.status === "PUBLISHED";

  function hasCreateSource(): boolean {
    if (createSourceMode === "UPLOAD") return Boolean(selectedVideoFile);
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
              ? "Ustaw opis, tłumaczenia, dostęp i plik wideo w jednym miejscu. Zapisz jako szkic albo poproś o publikację po zakodowaniu."
              : "Edytuj metadane filmu. Plik wideo i kodowanie są w szczegółach filmu (zakładka Media)."}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subtitleUrlPl">URL napisów PL (opcjonalnie)</Label>
                  <Input id="subtitleUrlPl" placeholder="https://..." value={formData.subtitleUrlPl} onChange={e => setFormData({...formData, subtitleUrlPl: e.target.value})} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitleUrlEn">URL napisów EN (opcjonalnie)</Label>
                  <Input id="subtitleUrlEn" placeholder="https://..." value={formData.subtitleUrlEn} onChange={e => setFormData({...formData, subtitleUrlEn: e.target.value})} disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descriptionEn">Opis (EN, opcjonalnie)</Label>
                <Textarea id="descriptionEn" value={formData.descriptionEn} onChange={e => setFormData({...formData, descriptionEn: e.target.value})} disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileVideo className="h-5 w-5" /> Wideo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isCreate ? (
                <>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                    <p className="font-semibold">Własne kodowanie i odtwarzanie</p>
                    <p className="mt-1 text-xs">Plik trafia prosto do naszego magazynu, potem sami go kodujemy do HLS. Postęp i ewentualne błędy zobaczysz w szczegółach filmu.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Źródło</Label>
                    <Select value={createSourceMode} onValueChange={(value) => onCreateSourceModeChange?.(value as CreateVideoSourceMode)} disabled={isSubmitting || isSourceLocked}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPLOAD">Wgraj plik wideo</SelectItem>
                        <SelectItem value="NONE">Brak pliku: zapisz szkic, wgram później</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {createSourceMode === "UPLOAD" && (
                    <div className="space-y-2">
                      <Label htmlFor="videoFile">Plik wideo {wantsPublish ? "(wymagany do publikacji)" : "(opcjonalny dla szkicu)"}</Label>
                      <Input
                        id="videoFile"
                        type="file"
                        accept="video/*,.mkv,.ts,.mts,.m2ts"
                        disabled={isSubmitting || isSourceLocked}
                        onChange={(event) => onVideoFileChange?.(event.target.files?.[0] || null)}
                      />
                      {selectedVideoFile ? (
                        <p className="text-xs font-medium text-muted-foreground">Wybrano: {selectedVideoFile.name}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Można zapisać pusty szkic, ale publikacja wymaga pliku.</p>
                      )}
                    </div>
                  )}

                  {createSourceMode === "NONE" && (
                    <p className="text-xs text-muted-foreground rounded-lg border border-amber-200 bg-amber-50 p-3">
                      Film zostanie zapisany jako szkic bez pliku. Plik wgrasz później w szczegółach filmu (zakładka Media).
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Upload i kodowanie są dostępne w zakładce Media szczegółów filmu.</p>
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

          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Send className="h-5 w-5" /> Publikacja</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div role="radiogroup" aria-label="Publikacja" className="space-y-2">
                {([
                  ["NOW", "Natychmiast"],
                  ["PREMIERE", "Premiera"],
                ] as const).map(([mode, label]) => (
                  <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="publishMode"
                      value={mode}
                      checked={formData.publishMode === mode}
                      onChange={() => setFormData(prev => ({ ...prev, publishMode: mode }))}
                      disabled={isSubmitting}
                      className="h-4 w-4 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {formData.publishMode === "PREMIERE" && (
                <div className="space-y-2">
                  <Label htmlFor="premiereLocal">Data i godzina premiery (Twój czas lokalny)</Label>
                  <Input
                    id="premiereLocal"
                    type="datetime-local"
                    value={formData.premiereLocal}
                    onChange={e => setFormData(prev => ({ ...prev, premiereLocal: e.target.value }))}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.publishMode === "PREMIERE"
                  ? isCreate
                    ? "Po publikacji film trafi do sekcji „Już wkrótce” z odliczaniem i sam stanie się zwykłym filmem w chwili premiery. Do tego czasu nie da się go odtworzyć."
                    : formData.status === "DRAFT"
                      ? "Zapis opublikuje szkic (jeśli jest gotowy do publikacji) i ustawi go w sekcji „Już wkrótce” do chwili premiery."
                      : "Film będzie w sekcji „Już wkrótce” z odliczaniem i sam stanie się zwykłym filmem w chwili premiery."
                  : "Film jest dostępny od razu po publikacji. Zmiana z premiery na „Natychmiast” odblokowuje go od razu."}
              </p>
            </CardContent>
          </Card>
          {sidebarExtra}
        </div>
      </div>
    </form>
  );
}
