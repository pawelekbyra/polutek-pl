"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, ShieldCheck, ImageIcon, AlertCircle, Save } from "@/app/components/icons";

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

export function VideoForm({
  formData,
  setFormData,
  formError,
  isSubmitting,
  onCancel,
  onSubmit,
  onTitleChange,
  onSlugChange,
  className
}: VideoFormProps) {
  const isCreate = !formData.id;

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
              ? "Utwórz bezpieczny szkic z metadanymi. Następny krok to upload pliku do Cloudflare Stream."
              : "Edytuj metadane filmu. Legacy URL pozostaje wyłącznie informacją migracyjną."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Anuluj</Button>
          <Button type="submit" disabled={isSubmitting || !formData.title.trim() || !formData.slug.trim()}>
            <Save className="mr-2 h-4 w-4" /> {isSubmitting ? "Zapisywanie..." : (isCreate ? "Utwórz szkic i przejdź do uploadu" : "Zapisz zmiany")}
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
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Miniatura</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="thumbnailUrl">URL miniatury (opcjonalnie)</Label>
              <Input id="thumbnailUrl" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} placeholder="Puste pole użyje domyślnego /logo.png" disabled={isSubmitting} />
            </CardContent>
          </Card>

          {!isCreate && formData.videoUrl ? (
            <Card className="border-dashed border-amber-200 bg-amber-50/40">
              <CardHeader><CardTitle className="text-sm text-amber-900">Advanced / Legacy migration</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="legacyVideoUrl">Legacy videoUrl (read-only)</Label>
                <Input id="legacyVideoUrl" value={formData.videoUrl} readOnly />
                <p className="text-xs text-amber-800">Ten URL służy tylko do migracji istniejących rekordów do Cloudflare Stream.</p>
              </CardContent>
            </Card>
          ) : null}
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
              {isCreate ? <p className="pt-3 text-xs text-muted-foreground">Status, HERO, sidebar i statystyki są sterowane przez serwer. Nowy film zawsze powstaje jako DRAFT.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
