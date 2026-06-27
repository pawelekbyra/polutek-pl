"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle, RotateCcw, Trash2, Star, Plus, Youtube, Video } from "@/app/components/icons";

interface VideoAsset {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  isPlayable: boolean;
  sourceMode: string;
  providerAssetId?: string | null;
  externalVideoId?: string | null;
  externalUrl?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

interface VideoSourcesPanelProps {
  video: any;
  onRefresh: () => void;
  onSyncCloudflare: () => void;
  onToast: (message: string, type: "success" | "error") => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  CLOUDFLARE_STREAM: "Cloudflare Stream",
  YOUTUBE: "YouTube",
  R2: "R2 (legacy)",
  S3: "S3 (legacy)",
  VERCEL_BLOB: "Vercel Blob (legacy)",
  MUX: "Mux (nie aktywny)",
};

const STATE_VARIANT: Record<string, "default" | "outline" | "destructive" | "secondary"> = {
  READY: "default",
  PROCESSING: "secondary",
  UPLOADING: "secondary",
  PENDING: "outline",
  FAILED: "destructive",
};

export function VideoSourcesPanel({ video, onRefresh, onSyncCloudflare, onToast }: VideoSourcesPanelProps) {
  const [showAddForm, setShowAddForm] = useState<"CLOUDFLARE_STREAM" | "YOUTUBE" | null>(null);
  const [cfUid, setCfUid] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const assets: VideoAsset[] = video.assets ?? [];
  const isPatron = video.tier === "PATRON";

  async function handleAddSource() {
    if (!showAddForm) return;
    setSubmitting(true);

    const body: any = { provider: showAddForm };
    if (showAddForm === "CLOUDFLARE_STREAM") body.providerAssetId = cfUid.trim();
    if (showAddForm === "YOUTUBE") body.youtubeUrl = youtubeUrl.trim();

    try {
      const res = await fetch(`/api/admin/videos/${video.id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onToast("Źródło zostało dodane.", "success");
        setShowAddForm(null);
        setCfUid("");
        setYoutubeUrl("");
        onRefresh();
      } else {
        const data = await res.json();
        onToast(`Błąd: ${data?.error?.message || data?.message || "Nieznany błąd"}`, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMakePrimary(assetId: string) {
    const res = await fetch(`/api/admin/videos/${video.id}/sources/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "make-primary" }),
    });
    if (res.ok) {
      onToast("Źródło zostało ustawione jako główne.", "success");
      onRefresh();
    } else {
      const data = await res.json();
      onToast(`Błąd: ${data?.error?.message || data?.message || "Nieznany błąd"}`, "error");
    }
  }

  async function handleDelete(assetId: string) {
    if (!window.confirm("Czy na pewno chcesz usunąć to źródło?")) return;
    const res = await fetch(`/api/admin/videos/${video.id}/sources/${assetId}`, { method: "DELETE" });
    if (res.ok) {
      onToast("Źródło zostało usunięte.", "success");
      onRefresh();
    } else {
      const data = await res.json();
      onToast(`Błąd: ${data?.error?.message || data?.message || "Nieznany błąd"}`, "error");
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg">Źródła wideo</CardTitle>
          <CardDescription className="text-xs mt-1">Zarządzaj źródłami odtwarzania. Tylko READY i produkcyjne źródła mogą być ustawione jako główne.</CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onSyncCloudflare} disabled={!assets.some(a => a.provider === "CLOUDFLARE_STREAM")}>
            <RotateCcw className="mr-2 h-3 w-3" /> Synchronizuj CF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm("CLOUDFLARE_STREAM")}>
            <Plus className="mr-2 h-3 w-3" /> Dodaj Cloudflare UID
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm("YOUTUBE")}
            disabled={isPatron}
            title={isPatron ? "YouTube nie jest dostępny dla filmów patron-only" : undefined}
          >
            <Youtube className="mr-2 h-3 w-3" /> Dodaj YouTube
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPatron && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Ten film jest <strong>PATRON-only</strong>. YouTube nie może być używany jako źródło ani ustawiony jako główne źródło odtwarzania.</p>
          </div>
        )}

        {showAddForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="font-semibold text-sm">
              {showAddForm === "CLOUDFLARE_STREAM" ? "Dodaj Cloudflare Stream UID" : "Dodaj źródło YouTube"}
            </p>
            {showAddForm === "CLOUDFLARE_STREAM" && (
              <div className="space-y-1">
                <Label className="text-xs">Cloudflare Stream UID</Label>
                <Input value={cfUid} onChange={(e) => setCfUid(e.target.value)} placeholder="np. abc123xyz" className="h-8 text-sm font-mono" />
              </div>
            )}
            {showAddForm === "YOUTUBE" && (
              <div className="space-y-1">
                <Label className="text-xs">URL YouTube</Label>
                <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="h-8 text-sm" />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddSource} disabled={submitting}>Dodaj</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(null); setCfUid(""); setYoutubeUrl(""); }}>Anuluj</Button>
            </div>
          </div>
        )}

        {assets.length === 0 ? (
          <div className="py-10 text-center border-dashed border-2 rounded-xl bg-muted/20">
            <Video className="h-8 w-8 mx-auto opacity-20 mb-2" />
            <p className="text-sm text-muted-foreground italic">Brak źródeł wideo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => (
              <SourceRow
                key={asset.id}
                asset={asset}
                isPatron={isPatron}
                onMakePrimary={() => handleMakePrimary(asset.id)}
                onDelete={() => handleDelete(asset.id)}
              />
            ))}
          </div>
        )}

        <div className="pt-2 text-[10px] text-muted-foreground space-y-0.5 border-t">
          <p><strong>Produkcyjne:</strong> Cloudflare Stream (signed playback), YouTube (embed, tylko PUBLIC).</p>
          <p><strong>Legacy/eksperymentalne:</strong> R2, S3, Vercel Blob, Mux — nie mogą być ustawione jako główne źródło odtwarzania.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceRow({ asset, isPatron, onMakePrimary, onDelete }: {
  asset: VideoAsset;
  isPatron: boolean;
  onMakePrimary: () => void;
  onDelete: () => void;
}) {
  const canBePrimary = asset.isPlayable && asset.processingState === "READY" && !(asset.provider === "YOUTUBE" && isPatron);

  return (
    <div className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${asset.isPrimary ? "border-green-400 bg-green-50/50" : "border-border bg-muted/20"}`}>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{PROVIDER_LABELS[asset.provider] ?? asset.provider}</span>
          {asset.isPrimary && <Badge className="bg-green-600 text-[10px] h-4 px-1.5"><Star className="h-2.5 w-2.5 mr-0.5" /> Główne</Badge>}
          <Badge variant={STATE_VARIANT[asset.processingState] ?? "outline"} className="text-[10px] h-4 px-1.5">{asset.processingState}</Badge>
          {!asset.isPlayable && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-400 text-amber-700">eksperymentalne</Badge>
          )}
        </div>
        {asset.providerAssetId && (
          <div className="text-[10px] text-muted-foreground font-mono truncate">CF UID: {asset.providerAssetId}</div>
        )}
        {asset.externalVideoId && (
          <div className="text-[10px] text-muted-foreground font-mono truncate">YT ID: {asset.externalVideoId}</div>
        )}
        {asset.externalUrl && (
          <a href={asset.externalUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 truncate block hover:underline">{asset.externalUrl}</a>
        )}
        {asset.failureReason && (
          <div className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />{asset.failureReason}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {!asset.isPrimary && canBePrimary && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={onMakePrimary} title="Ustaw jako główne">
            <Star className="h-3 w-3" />
          </Button>
        )}
        {!asset.isPrimary && (
          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive hover:text-destructive" onClick={onDelete} title="Usuń źródło">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
