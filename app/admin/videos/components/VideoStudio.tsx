"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { CoverImageUpload } from "./CoverImageUpload";

interface StudioAsset {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  fallbackPriority: number;
}

interface StudioOriginal {
  id: string;
  status: string;
  objectKey: string;
  sizeBytes: string | null;
  uploadCompletedAt: string | null;
}

interface VideoStudioProps {
  videoId: string;
  initialVideo: {
    title: string;
    description?: string | null;
    slug: string;
    tier: string;
    thumbnailUrl?: string | null;
    status: string;
    assets?: StudioAsset[];
    original?: StudioOriginal | null;
  };
  onSaved?: () => void;
}

function readApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Nieznany błąd.";
}

function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function VideoStudio({ videoId, initialVideo, onSaved }: VideoStudioProps) {
  const toast = useToast();
  const [title, setTitle] = useState(initialVideo.title);
  const [description, setDescription] = useState(initialVideo.description ?? "");
  const [tier, setTier] = useState(initialVideo.tier);
  const [thumbnailUrl, setThumbnailUrl] = useState(initialVideo.thumbnailUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preferredProvider, setPreferredProvider] = useState("CLOUDFLARE_STREAM");
  const assets = initialVideo.assets ?? [];
  const original = initialVideo.original ?? null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, tier, thumbnailUrl }),
      });
      if (!res.ok) throw new Error("Nie udało się zapisać.");
      toast("Zapisano.", "success");
      onSaved?.();
    } catch {
      toast("Błąd zapisu.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const provisionRes = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "video/mp4",
        }),
      });
      if (!provisionRes.ok) {
        const body = await provisionRes.json().catch((): unknown => null);
        throw new Error(readApiError(body) ?? "Nie udało się przygotować uploadu.");
      }

      const provision = await provisionRes.json() as { uploadUrl: string; originalId: string };
      const uploadRes = await fetch(provision.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload do R2 nieudany (HTTP ${uploadRes.status}).`);

      const completeRes = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalId: provision.originalId, mirrorPlan: { mux: true, cloudflare: true }, preferredProvider }),
      });
      if (!completeRes.ok) {
        const body = await completeRes.json().catch((): unknown => null);
        throw new Error(readApiError(body) ?? "Nie udało się uruchomić mirrorów.");
      }

      setFile(null);
      toast("Plik wgrany. Odświeżam stan filmu.", "success");
      onSaved?.();
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_360px] md:p-6">
      <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pipeline</p>
            <h2 className="text-lg font-semibold">Oryginał i mirrory</h2>
          </div>
          <Badge variant={original?.status === "READY" ? "default" : "outline"}>{original?.status ?? "BRAK ORYGINAŁU"}</Badge>
        </div>

        <div className="rounded-lg border bg-background p-3 text-sm">
          {assets.length > 0 ? (
            <div className="space-y-2">
              {assets
                .slice()
                .sort((a, b) => a.fallbackPriority - b.fallbackPriority)
                .map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
                    <span className="font-medium">{asset.provider.replace("_", " ")}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={asset.processingState === "READY" ? "default" : "outline"}>{asset.processingState}</Badge>
                      {asset.isPrimary && <Badge variant="secondary">primary</Badge>}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Brak aktywnych źródeł wideo.</p>
          )}
        </div>

        <div className="rounded-lg border bg-background p-4 space-y-3">
          <Label htmlFor="studio-file-input" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nowy oryginał</Label>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Primary provider</Label>
            <Select value={preferredProvider} onValueChange={setPreferredProvider} disabled={uploading}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLOUDFLARE_STREAM">Cloudflare Stream</SelectItem>
                <SelectItem value="MUX">Mux</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input id="studio-file-input" type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          {file && <p className="text-xs text-muted-foreground">{file.name} · {formatBytes(file.size)}</p>}
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Wgraj i uruchom mirrory
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Miniatura</Label>
          <CoverImageUpload videoId={videoId} initialUrl={thumbnailUrl} onUploadSuccess={(url) => setThumbnailUrl(url)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="studio-title">Tytuł</Label>
          <Input id="studio-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="studio-desc">Opis</Label>
          <Textarea id="studio-desc" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        </div>
        <div className="space-y-1.5">
          <Label>Dostęp</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Publiczny</SelectItem>
              <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
              <SelectItem value="PATRON">Patron</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Zapisz
        </Button>
      </div>
    </div>
  );
}
