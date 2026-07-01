"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Edit } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { CoverImageUpload } from "./CoverImageUpload";
import { VideoSourcesPanel } from "./VideoSourcesPanel";
import { AdminVideoAssetDto } from "@/lib/modules/video/domain/video.dto";
import Link from "next/link";

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
    assets?: AdminVideoAssetDto[];
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

  const handleThumbnailUpload = async (url: string) => {
    setThumbnailUrl(url);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: url }),
      });
      if (!res.ok) {
        const body = await res.json().catch((): unknown => null);
        throw new Error(readApiError(body) ?? "Nie udało się zapisać miniatury.");
      }
      toast("Miniatura zapisana.", "success");
      onSaved?.();
    } catch (error) {
      toast(getErrorMessage(error), "error");
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
      <div className="space-y-4">
        <VideoSourcesPanel
          videoId={videoId}
          assets={assets}
          tier={tier}
          onChanged={() => onSaved?.()}
        />

        <div className="rounded-lg border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Oryginał (R2)</h3>
            <Badge variant={original?.status === "READY" ? "default" : "outline"}>{original?.status ?? "BRAK"}</Badge>
          </div>
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
          <CoverImageUpload videoId={videoId} initialUrl={thumbnailUrl} onUploadSuccess={handleThumbnailUpload} />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Metadane</h4>
            <Button variant="outline" asChild className="w-full justify-start gap-2 h-11">
                <Link href={`/admin/videos/${videoId}/edit`}>
                    <Edit className="h-4 w-4" />
                    Edytuj tytuł, opis i dostęp →
                </Link>
            </Button>
            <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
                Tytuł, opis i ustawienia dostępu (tier) są zarządzane w głównym formularzu edycji filmu.
            </p>
        </div>
      </div>
    </div>
  );
}
