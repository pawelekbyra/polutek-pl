"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Upload, XCircle, Loader2, FileVideo,
  Star, ChevronDown, ChevronUp, Play,
} from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { CoverImageUpload } from "./CoverImageUpload";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudioAsset {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  fallbackPriority: number;
  mirrorRequestedAt?: string | null;
  mirrorCompletedAt?: string | null;
  mirrorFailureReason?: string | null;
  failureReason?: string | null;
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

// ─── Pipeline node ────────────────────────────────────────────────────────────

function PipelineNode({
  provider,
  asset,
  isOriginal,
  status,
  isPending,
  onMakePrimary,
  makingPrimary,
}: {
  provider: string;
  asset?: StudioAsset | null;
  isOriginal?: boolean;
  status?: string;
  isPending?: boolean;
  onMakePrimary?: () => void;
  makingPrimary?: boolean;
}) {
  const state = isOriginal ? status : asset?.processingState;
  const isReady = state === "READY";
  const isFailed = state === "FAILED";
  const isProcessing = state === "PROCESSING" || state === "UPLOADING" || state === "PENDING" || isPending;

  const label: Record<string, string> = {
    CLOUDFLARE_STREAM: "Cloudflare",
    MUX: "Mux",
    VIMEO: "Vimeo",
    YOUTUBE: "YouTube",
    R2: "R2 Original",
  };

  const color = isReady
    ? "bg-green-500"
    : isFailed
    ? "bg-red-500"
    : isProcessing
    ? "bg-amber-400 animate-pulse"
    : "bg-muted-foreground/30";

  return (
    <div className="flex flex-col items-center gap-1 min-w-[80px]">
      <div className={`w-3 h-3 rounded-full ${color} transition-colors duration-500`} />
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label[provider] ?? provider}
      </span>
      {asset?.isPrimary && (
        <Badge className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-0">primary</Badge>
      )}
      {isReady && !isOriginal && !asset?.isPrimary && onMakePrimary && (
        <button
          onClick={onMakePrimary}
          disabled={makingPrimary}
          className="text-[9px] text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
        >
          {makingPrimary ? "..." : "ustaw primary"}
        </button>
      )}
      {isFailed && <span className="text-[9px] text-red-500">błąd</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoStudio({ videoId, initialVideo, onSaved }: VideoStudioProps) {
  const toast = useToast();

  // Form state
  const [title, setTitle] = useState(initialVideo.title);
  const [description, setDescription] = useState(initialVideo.description ?? "");
  const [tier, setTier] = useState(initialVideo.tier);
  const [thumbnailUrl, setThumbnailUrl] = useState(initialVideo.thumbnailUrl ?? "");
  const [saving, setSaving] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [uploadEta, setUploadEta] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "completing" | "done" | "failed">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadStartRef = useRef<number>(0);

  // Mirror config
  const [mirrorMux, setMirrorMux] = useState(true);
  const [mirrorCF, setMirrorCF] = useState(true);

  // Live status from SSE
  const [original, setOriginal] = useState<StudioOriginal | null>(initialVideo.original ?? null);
  const [assets, setAssets] = useState<StudioAsset[]>(initialVideo.assets ?? []);
  const [makingPrimary, setMakingPrimary] = useState<string | null>(null);

  // Collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false);

  // SSE connection — stored in ref so cleanup always sees the latest instance
  const sseRef = useRef<EventSource | null>(null);

  const startSSE = useCallback(() => {
    // Always close the previous connection before opening a new one
    sseRef.current?.close();
    const es = new EventSource(`/api/admin/videos/${videoId}/stream`);
    sseRef.current = es;

    es.addEventListener("status", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (data.original) setOriginal(data.original);
      if (data.assets) setAssets(data.assets);
    });

    es.addEventListener("done", () => {
      es.close();
      if (sseRef.current === es) sseRef.current = null;
    });

    es.addEventListener("error", () => {
      es.close();
      if (sseRef.current === es) sseRef.current = null;
    });
  }, [videoId]);

  useEffect(() => {
    const hasInProgress =
      (initialVideo.original &&
        initialVideo.original.status !== "READY" &&
        initialVideo.original.status !== "FAILED") ||
      (initialVideo.assets ?? []).some(
        (a) => a.processingState !== "READY" && a.processingState !== "FAILED"
      );

    if (hasInProgress) startSSE();

    // Cleanup always closes whatever sseRef points to at unmount time
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [startSSE, initialVideo.original, initialVideo.assets]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setUploadPhase("idle");
      setUploadError(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadPhase("uploading");
    setUploadError(null);
    setUploadProgress(0);
    uploadStartRef.current = Date.now();

    try {
      const provRes = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "video/mp4",
        }),
      });

      if (!provRes.ok) {
        const err = await provRes.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Nie udało się zainicjować uploadu.");
      }

      const { uploadUrl, originalId } = await provRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setUploadProgress(pct);

          const elapsed = (Date.now() - uploadStartRef.current) / 1000;
          if (elapsed <= 0) return;
          const bytesPerSec = ev.loaded / elapsed;
          const remaining = ev.total - ev.loaded;
          const etaSec = remaining / bytesPerSec;

          setUploadSpeed(formatBytes(bytesPerSec) + "/s");
          setUploadEta(etaSec > 0 && isFinite(etaSec) ? formatEta(etaSec) : null);
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload do R2 nieudany (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Błąd sieci podczas uploadu."));
        xhr.send(file);
      });

      setUploadPhase("completing");
      const completeRes = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalId,
          mirrorPlan: { mux: mirrorMux, cloudflare: mirrorCF },
        }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Nie udało się uruchomić mirrorów.");
      }

      setUploadPhase("done");
      toast("Plik wgrany! Mirrorowanie w toku.", "success");
      startSSE();
    } catch (err: any) {
      setUploadError(err.message ?? "Nieznany błąd.");
      setUploadPhase("failed");
    }
  };

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

  const handleMakePrimary = async (assetId: string) => {
    setMakingPrimary(assetId);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_primary" }),
      });
      if (!res.ok) throw new Error();
      toast("Źródło główne zmienione.", "success");
      startSSE();
    } catch {
      toast("Nie udało się zmienić źródła.", "error");
    } finally {
      setMakingPrimary(null);
    }
  };

  const primaryAsset = assets.find((a) => a.isPrimary);
  const hasReadyAsset = assets.some((a) => a.processingState === "READY");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-4 md:p-6 min-h-screen">
      {/* ── Left: player / upload area ── */}
      <div className="space-y-4">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/90 border border-border/50 shadow-lg">
          {hasReadyAsset ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white/40 flex flex-col items-center gap-2">
                <Play className="h-12 w-12" />
                <span className="text-sm">Przejdź do podglądu</span>
              </div>
            </div>
          ) : uploadPhase === "uploading" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-4">
              <FileVideo className="h-10 w-10 text-white/50" />
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between text-white/70 text-sm">
                  <span>{uploadSpeed ?? "Przesyłanie..."}</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5 bg-white/10" />
                {uploadEta && (
                  <p className="text-center text-white/40 text-xs">pozostało ~{uploadEta}</p>
                )}
              </div>
            </div>
          ) : uploadPhase === "completing" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-3 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Uruchamiam mirrorowanie...</span>
              </div>
            </div>
          ) : uploadPhase === "failed" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8">
              <XCircle className="h-10 w-10 text-red-400" />
              <p className="text-red-300 text-sm text-center">{uploadError}</p>
              <Button size="sm" variant="outline" onClick={() => setUploadPhase("idle")} className="text-white border-white/20">
                Spróbuj ponownie
              </Button>
            </div>
          ) : (
            <label
              htmlFor="studio-file-input"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer group"
            >
              <input
                id="studio-file-input"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="h-16 w-16 rounded-2xl bg-white/10 group-hover:bg-white/20 transition flex items-center justify-center">
                <Upload className="h-7 w-7 text-white/60 group-hover:text-white/90 transition" />
              </div>
              <p className="text-white/50 text-sm group-hover:text-white/70 transition">
                {file ? file.name : "Przeciągnij film lub kliknij"}
              </p>
              {file && <p className="text-white/30 text-xs">{formatBytes(file.size)}</p>}
            </label>
          )}
        </div>

        {/* File selected — mirror options + start button */}
        {file && uploadPhase === "idle" && (
          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[60%]">{file.name}</span>
              <span className="text-muted-foreground">{formatBytes(file.size)}</span>
            </div>
            <div className="flex gap-3 items-center text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={mirrorMux} onChange={(e) => setMirrorMux(e.target.checked)} className="rounded" />
                Mirror → Mux
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={mirrorCF} onChange={(e) => setMirrorCF(e.target.checked)} className="rounded" />
                Mirror → Cloudflare
              </label>
            </div>
            <Button onClick={handleUpload} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Wgraj film
            </Button>
          </div>
        )}

        {/* Pipeline */}
        <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-3">Pipeline</p>
          <div className="flex items-start gap-2 flex-wrap">
            <PipelineNode
              provider="R2"
              isOriginal
              status={original?.status ?? (uploadPhase === "done" || uploadPhase === "completing" ? "UPLOADING" : undefined)}
            />
            {(assets.length > 0 || mirrorMux || mirrorCF) && (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-muted-foreground/40 text-xs mt-1">──▶</span>
                {assets
                  .slice()
                  .sort((a, b) => a.fallbackPriority - b.fallbackPriority)
                  .map((asset) => (
                    <PipelineNode
                      key={asset.id}
                      provider={asset.provider}
                      asset={asset}
                      onMakePrimary={() => handleMakePrimary(asset.id)}
                      makingPrimary={makingPrimary === asset.id}
                    />
                  ))}
                {assets.length === 0 && uploadPhase === "done" && (
                  <>
                    {mirrorMux && <PipelineNode provider="MUX" isPending />}
                    {mirrorCF && <PipelineNode provider="CLOUDFLARE_STREAM" isPending />}
                  </>
                )}
              </div>
            )}
          </div>
          {assets.some((a) => a.processingState === "PROCESSING" || a.processingState === "PENDING") && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Przetwarzanie... status aktualizuje się automatycznie
            </p>
          )}
        </div>
      </div>

      {/* ── Right: form sidebar ── */}
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Miniatura</Label>
          <CoverImageUpload
            videoId={videoId}
            initialUrl={thumbnailUrl}
            onUploadSuccess={(url) => setThumbnailUrl(url)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="studio-title" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tytuł</Label>
          <Input
            id="studio-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł filmu"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="studio-desc" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Opis</Label>
          <Textarea
            id="studio-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opis..."
            rows={4}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dostęp</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Publiczny</SelectItem>
              <SelectItem value="LOGGED_IN">Zalogowani</SelectItem>
              <SelectItem value="PATRON">Patron</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {primaryAsset && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
            <p className="text-muted-foreground font-bold uppercase tracking-wide text-[10px]">Aktywne źródło</p>
            <p className="font-medium">{primaryAsset.provider.replace("_", " ")}</p>
            <p className={primaryAsset.processingState === "READY" ? "text-green-600" : "text-amber-600"}>
              {primaryAsset.processingState}
            </p>
          </div>
        )}

        {assets.length > 1 && (
          <div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Wszystkie źródła ({assets.length})
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2">
                {assets.map((a) => (
                  <div key={a.id} className="rounded-lg border px-3 py-2 text-xs flex items-center justify-between">
                    <span className="font-medium">{a.provider.replace("_", " ")}</span>
                    <div className="flex items-center gap-2">
                      <span className={a.processingState === "READY" ? "text-green-600" : "text-muted-foreground"}>
                        {a.processingState}
                      </span>
                      {!a.isPrimary && a.processingState === "READY" && (
                        <button
                          onClick={() => handleMakePrimary(a.id)}
                          disabled={makingPrimary === a.id}
                          className="text-primary hover:underline disabled:opacity-50"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      )}
                      {a.isPrimary && <Star className="h-3 w-3 fill-primary text-primary" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Zapisz
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
