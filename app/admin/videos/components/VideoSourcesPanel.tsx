"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Star, Trash2, Plus, Youtube, Globe } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { AdminVideoAssetDto } from "@/lib/modules/video/domain/video.dto";

interface VideoSourcesPanelProps {
  videoId: string;
  assets: AdminVideoAssetDto[];
  tier: string;
  onChanged: () => void;
}

function ProviderBadge({ provider }: { provider: string }) {
  if (provider === "CLOUDFLARE_STREAM") return <Badge variant="secondary" className="gap-1"><Globe className="h-3 w-3" />Cloudflare Stream</Badge>;
  if (provider === "MUX") return <Badge variant="secondary" className="gap-1 text-violet-700 bg-violet-50">▶ Mux</Badge>;
  if (provider === "YOUTUBE") return <Badge variant="secondary" className="gap-1 text-red-600"><Youtube className="h-3 w-3" />YouTube</Badge>;
  if (provider === "VIMEO") return <Badge variant="secondary" className="gap-1 text-sky-700 bg-sky-50">◈ Vimeo</Badge>;
  return <Badge variant="outline">{provider}</Badge>;
}

function StateBadge({ state, isPlayable }: { state: string; isPlayable: boolean }) {
  if (isPlayable) return <Badge className="gap-1 bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3" />Gotowy</Badge>;
  if (state === "FAILED") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Błąd</Badge>;
  if (state === "PROCESSING" || state === "UPLOADING") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Przetwarzanie</Badge>;
  if (state === "PENDING") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Oczekuje</Badge>;
  return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />{state}</Badge>;
}

type AddMode = "cf" | "mux-existing" | "mux-upload" | "yt" | "vimeo" | null;

export function VideoSourcesPanel({ videoId, assets, tier, onChanged }: VideoSourcesPanelProps) {
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);

  const [cfAssetId, setCfAssetId] = useState("");
  const [muxPlaybackId, setMuxPlaybackId] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");
  const [vimeoVideoId, setVimeoVideoId] = useState("");

  function toggleAdd(mode: AddMode) {
    setAddMode(prev => prev === mode ? null : mode);
  }

  async function handleSetActiveSource(assetId: string) {
    setLoading(`active-${assetId}`);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/playback-route`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się zmienić aktywnego źródła.", "error");
        return;
      }
      toast("Aktywne źródło na stronie zostało zmienione.", "success");
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(assetId: string) {
    if (pendingRemove !== assetId) {
      setPendingRemove(assetId);
      return;
    }
    setPendingRemove(null);
    setLoading(`remove-${assetId}`);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources/${assetId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się usunąć źródła.", "error");
        return;
      }
      toast("Źródło zostało usunięte.", "success");
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  async function handleAddSource(provider: string, body: Record<string, unknown>, loadingKey: string, successMsg: string) {
    setLoading(loadingKey);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się dodać źródła.", "error");
        return;
      }
      toast(successMsg, "success");
      setAddMode(null);
      setCfAssetId(""); setMuxPlaybackId(""); setYtVideoId(""); setVimeoVideoId("");
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  async function handleMuxUpload() {
    setLoading("mux-upload");
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources/mux-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryIntent: assets.length === 0 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się przygotować uploadu Mux.", "error");
        return;
      }
      const data = await res.json();
      // Open Mux upload URL in a new tab for the user to drag-and-drop
      window.open(data.uploadUrl, "_blank", "noopener,noreferrer");
      toast("Link do uploadu Mux otwarty w nowej karcie. Po przesłaniu pliku asset pojawi się automatycznie.", "success");
      setAddMode(null);
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  const isPatron = tier === "PATRON";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Źródła wideo</CardTitle>
        <CardDescription>Zarządzaj źródłami odtwarzania. Tylko jedno źródło jest aktywne na stronie.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assets.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak przypisanych źródeł wideo.</p>
        )}

        {assets.map((asset) => (
          <div key={asset.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            {asset.provider === "YOUTUBE" && asset.externalVideoId && (
              <div className="h-12 w-20 rounded overflow-hidden shrink-0 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${asset.externalVideoId}/mqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            {asset.provider === "MUX" && (asset.providerPlaybackId || asset.providerAssetId) && (
              <div className="h-12 w-20 rounded overflow-hidden shrink-0 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://image.mux.com/${asset.providerPlaybackId || asset.providerAssetId}/thumbnail.jpg?width=160&height=90&fit_mode=preserve`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ProviderBadge provider={asset.provider} />
                <StateBadge state={asset.processingState} isPlayable={asset.isPlayable} />
                {asset.isPrimary && <Badge className="gap-1 bg-amber-100 text-amber-800"><Star className="h-3 w-3" />Aktywne</Badge>}
              </div>
              {asset.provider === "YOUTUBE" && asset.externalVideoId && (
                <p className="text-xs text-muted-foreground font-mono truncate">youtube.com/watch?v={asset.externalVideoId}</p>
              )}
              {asset.provider === "VIMEO" && asset.externalVideoId && (
                <p className="text-xs text-muted-foreground font-mono truncate">vimeo.com/{asset.externalVideoId}</p>
              )}
              {asset.provider === "CLOUDFLARE_STREAM" && asset.providerAssetId && (
                <p className="text-xs text-muted-foreground font-mono truncate">{asset.providerAssetId}</p>
              )}
              {asset.provider === "MUX" && (asset.providerPlaybackId || asset.providerAssetId) && (
                <p className="text-xs text-muted-foreground font-mono truncate">playbackId: {asset.providerPlaybackId || asset.providerAssetId}</p>
              )}
              {asset.failureReason && (
                <p className="text-xs text-destructive truncate">{asset.failureReason}</p>
              )}
              {(asset.provider === "YOUTUBE" || asset.provider === "VIMEO") && isPatron && !asset.isPrimary && (
                <p className="text-xs text-amber-600">{asset.provider === "YOUTUBE" ? "YouTube" : "Vimeo"} niedostępny dla tieru PATRON</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!asset.isPrimary && asset.isPlayable && !(isPatron && (asset.provider === "YOUTUBE" || asset.provider === "VIMEO")) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetActiveSource(asset.id)}
                  disabled={loading !== null}
                >
                  {loading === `active-${asset.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Ustaw aktywne</span>
                </Button>
              )}
              {!asset.isPrimary && (
                pendingRemove === asset.id ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="destructive" onClick={() => handleRemove(asset.id)} disabled={loading !== null}>Usuń</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPendingRemove(null)}>Anuluj</Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemove(asset.id)}
                    disabled={loading !== null}
                  >
                    {loading === `remove-${asset.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )
              )}
            </div>
          </div>
        ))}

        {/* Add source buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => toggleAdd("cf")}>
            <Plus className="h-4 w-4 mr-1" /><Globe className="h-4 w-4 mr-1" />Cloudflare Stream
          </Button>
          <Button size="sm" variant="outline" onClick={() => toggleAdd("mux-upload")}>
            <Plus className="h-4 w-4 mr-1" /><span className="text-violet-700 font-semibold mr-1">▶</span>Mux — upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => toggleAdd("mux-existing")}>
            <Plus className="h-4 w-4 mr-1" /><span className="text-violet-700 font-semibold mr-1">▶</span>Mux — istniejący
          </Button>
          {!isPatron && (
            <>
              <Button size="sm" variant="outline" onClick={() => toggleAdd("yt")}>
                <Plus className="h-4 w-4 mr-1" /><Youtube className="h-4 w-4 mr-1 text-red-600" />YouTube
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleAdd("vimeo")}>
                <Plus className="h-4 w-4 mr-1" /><span className="text-sky-700 font-semibold mr-1">◈</span>Vimeo
              </Button>
            </>
          )}
        </div>

        {/* Add Cloudflare by UID */}
        {addMode === "cf" && (
          <div className="space-y-2 p-3 rounded-lg border">
            <Label htmlFor="cf-asset-id">Cloudflare Stream Asset UID</Label>
            <div className="flex gap-2">
              <Input
                id="cf-asset-id"
                placeholder="np. abc123def456..."
                value={cfAssetId}
                onChange={(e: { target: { value: string } }) => setCfAssetId(e.target.value)}
                onKeyDown={(e: { key: string }) => e.key === "Enter" && cfAssetId.trim() && handleAddSource("CLOUDFLARE_STREAM", { providerAssetId: cfAssetId.trim() }, "add-cf", "Źródło Cloudflare Stream dodane.")}
              />
              <Button onClick={() => handleAddSource("CLOUDFLARE_STREAM", { providerAssetId: cfAssetId.trim() }, "add-cf", "Źródło Cloudflare Stream dodane.")} disabled={!cfAssetId.trim() || loading === "add-cf"}>
                {loading === "add-cf" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          </div>
        )}

        {/* Add Mux by existing playback ID */}
        {addMode === "mux-existing" && (
          <div className="space-y-2 p-3 rounded-lg border">
            <Label htmlFor="mux-playback-id">Mux Playback ID (istniejący asset)</Label>
            <p className="text-xs text-muted-foreground">Podaj Mux Playback ID — asset musi być już READY w Mux Dashboard.</p>
            <div className="flex gap-2">
              <Input
                id="mux-playback-id"
                placeholder="np. VZtzUzGRv02OhRnZQxqoE5Am8XuZVaE..."
                value={muxPlaybackId}
                onChange={(e: { target: { value: string } }) => setMuxPlaybackId(e.target.value)}
                onKeyDown={(e: { key: string }) => e.key === "Enter" && muxPlaybackId.trim() && handleAddSource("MUX", { providerAssetId: muxPlaybackId.trim() }, "add-mux", "Źródło Mux dodane.")}
              />
              <Button onClick={() => handleAddSource("MUX", { providerAssetId: muxPlaybackId.trim() }, "add-mux", "Źródło Mux dodane.")} disabled={!muxPlaybackId.trim() || loading === "add-mux"}>
                {loading === "add-mux" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          </div>
        )}

        {/* Mux upload flow */}
        {addMode === "mux-upload" && (
          <div className="space-y-2 p-3 rounded-lg border border-violet-200 bg-violet-50/50">
            <p className="text-sm font-medium text-violet-900">Upload do Mux</p>
            <p className="text-xs text-violet-700">
              {'Kliknij „Otwórz upload” — zostanie wygenerowany link do uploadu Mux i otwarty w nowej karcie.'}
              Gdy upload się zakończy, Mux przetworzy film i wyśle webhook do systemu — asset pojawi się automatycznie.
            </p>
            <Button
              size="sm"
              onClick={handleMuxUpload}
              disabled={loading === "mux-upload"}
              className="bg-violet-700 hover:bg-violet-800 text-white"
            >
              {loading === "mux-upload" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Otwórz upload Mux
            </Button>
          </div>
        )}

        {/* Add YouTube */}
        {addMode === "yt" && (
          <div className="space-y-2 p-3 rounded-lg border">
            <Label htmlFor="yt-video-id">YouTube URL lub ID wideo</Label>
            <div className="flex gap-2">
              <Input
                id="yt-video-id"
                placeholder="np. https://youtube.com/watch?v=abc lub abc"
                value={ytVideoId}
                onChange={(e: { target: { value: string } }) => setYtVideoId(e.target.value)}
                onKeyDown={(e: { key: string }) => e.key === "Enter" && ytVideoId.trim() && handleAddSource("YOUTUBE", { externalVideoId: ytVideoId.trim() }, "add-yt", "Źródło YouTube dodane.")}
              />
              <Button onClick={() => handleAddSource("YOUTUBE", { externalVideoId: ytVideoId.trim() }, "add-yt", "Źródło YouTube dodane.")} disabled={!ytVideoId.trim() || loading === "add-yt"}>
                {loading === "add-yt" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          </div>
        )}

        {/* Add Vimeo */}
        {addMode === "vimeo" && (
          <div className="space-y-2 p-3 rounded-lg border">
            <Label htmlFor="vimeo-video-id">Vimeo URL lub ID wideo</Label>
            <div className="flex gap-2">
              <Input
                id="vimeo-video-id"
                placeholder="np. https://vimeo.com/123456789 lub 123456789"
                value={vimeoVideoId}
                onChange={(e: { target: { value: string } }) => setVimeoVideoId(e.target.value)}
                onKeyDown={(e: { key: string }) => e.key === "Enter" && vimeoVideoId.trim() && handleAddSource("VIMEO", { externalVideoId: vimeoVideoId.trim() }, "add-vimeo", "Źródło Vimeo dodane.")}
              />
              <Button onClick={() => handleAddSource("VIMEO", { externalVideoId: vimeoVideoId.trim() }, "add-vimeo", "Źródło Vimeo dodane.")} disabled={!vimeoVideoId.trim() || loading === "add-vimeo"}>
                {loading === "add-vimeo" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          </div>
        )}

        {isPatron && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            YouTube i Vimeo niedostępne dla tieru PATRON — brak bezpiecznego prywatnego playbacku. Użyj Cloudflare Stream lub Mux.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
