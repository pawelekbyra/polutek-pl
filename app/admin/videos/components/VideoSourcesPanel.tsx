"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Star, Trash2, Plus, Youtube, Globe } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";

interface VideoAsset {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  isPlayable: boolean;
  sourceMode: string;
  externalVideoId?: string | null;
  externalUrl?: string | null;
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

interface VideoSourcesPanelProps {
  videoId: string;
  assets: VideoAsset[];
  tier: string;
  onChanged: () => void;
}

function ProviderBadge({ provider }: { provider: string }) {
  if (provider === "CLOUDFLARE_STREAM") return <Badge variant="secondary" className="gap-1"><Globe className="h-3 w-3" />Cloudflare Stream</Badge>;
  if (provider === "YOUTUBE") return <Badge variant="secondary" className="gap-1 text-red-600"><Youtube className="h-3 w-3" />YouTube</Badge>;
  return <Badge variant="outline">{provider}</Badge>;
}

function StateBadge({ state, isPlayable }: { state: string; isPlayable: boolean }) {
  if (isPlayable) return <Badge className="gap-1 bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3" />Gotowy</Badge>;
  if (state === "FAILED") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Błąd</Badge>;
  if (state === "PROCESSING" || state === "UPLOADING") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Przetwarzanie</Badge>;
  return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />{state}</Badge>;
}

export function VideoSourcesPanel({ videoId, assets, tier, onChanged }: VideoSourcesPanelProps) {
  const toast = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const [showAddCf, setShowAddCf] = useState(false);
  const [showAddYt, setShowAddYt] = useState(false);
  const [cfAssetId, setCfAssetId] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");

  async function handleSetPrimary(assetId: string) {
    setLoading(`primary-${assetId}`);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_primary" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się zmienić źródła głównego.", "error");
        return;
      }
      toast("Źródło główne zostało zmienione.", "success");
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(assetId: string) {
    if (!confirm("Usunąć to źródło? Tej operacji nie można cofnąć.")) return;
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

  async function handleAddCloudflare() {
    if (!cfAssetId.trim()) return;
    setLoading("add-cf");
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "CLOUDFLARE_STREAM", providerAssetId: cfAssetId.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się dodać źródła Cloudflare.", "error");
        return;
      }
      toast("Źródło Cloudflare Stream dodane.", "success");
      setCfAssetId("");
      setShowAddCf(false);
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  async function handleAddYoutube() {
    if (!ytVideoId.trim()) return;
    setLoading("add-yt");
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "YOUTUBE", externalVideoId: ytVideoId.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast((err as Record<string, string>).error || "Nie udało się dodać źródła YouTube.", "error");
        return;
      }
      toast("Źródło YouTube dodane.", "success");
      setYtVideoId("");
      setShowAddYt(false);
      onChanged();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Źródła wideo</CardTitle>
        <CardDescription>Zarządzaj źródłami odtwarzania. Tylko jedno źródło może być główne (primary).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assets.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak przypisanych źródeł wideo.</p>
        )}

        {assets.map((asset) => (
          <div key={asset.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ProviderBadge provider={asset.provider} />
                <StateBadge state={asset.processingState} isPlayable={asset.isPlayable} />
                {asset.isPrimary && <Badge className="gap-1 bg-amber-100 text-amber-800"><Star className="h-3 w-3" />Primary</Badge>}
              </div>
              {asset.provider === "YOUTUBE" && asset.externalVideoId && (
                <p className="text-xs text-muted-foreground font-mono truncate">youtube.com/watch?v={asset.externalVideoId}</p>
              )}
              {asset.provider === "CLOUDFLARE_STREAM" && asset.providerAssetId && (
                <p className="text-xs text-muted-foreground font-mono truncate">{asset.providerAssetId}</p>
              )}
              {asset.failureReason && (
                <p className="text-xs text-destructive truncate">{asset.failureReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!asset.isPrimary && asset.isPlayable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetPrimary(asset.id)}
                  disabled={loading !== null}
                >
                  {loading === `primary-${asset.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Ustaw primary</span>
                </Button>
              )}
              {!asset.isPrimary && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRemove(asset.id)}
                  disabled={loading !== null}
                >
                  {loading === `remove-${asset.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => { setShowAddCf(!showAddCf); setShowAddYt(false); }}>
            <Plus className="h-4 w-4 mr-1" /><Globe className="h-4 w-4 mr-1" />Cloudflare Stream
          </Button>
          {tier !== "PATRON" && (
            <Button size="sm" variant="outline" onClick={() => { setShowAddYt(!showAddYt); setShowAddCf(false); }}>
              <Plus className="h-4 w-4 mr-1" /><Youtube className="h-4 w-4 mr-1 text-red-600" />YouTube
            </Button>
          )}
        </div>

        {showAddCf && (
          <div className="space-y-2 p-3 rounded-lg border">
            <Label htmlFor="cf-asset-id">Cloudflare Stream Asset UID</Label>
            <div className="flex gap-2">
              <Input
                id="cf-asset-id"
                placeholder="np. abc123def456..."
                value={cfAssetId}
                onChange={(e: { target: { value: string } }) => setCfAssetId(e.target.value)}
                onKeyDown={(e: { key: string }) => e.key === "Enter" && handleAddCloudflare()}
              />
              <Button onClick={handleAddCloudflare} disabled={!cfAssetId.trim() || loading === "add-cf"}>
                {loading === "add-cf" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          </div>
        )}

        {showAddYt && (
          <div className="space-y-2 p-3 rounded-lg border">
            <Label htmlFor="yt-video-id">YouTube URL lub ID wideo</Label>
            <div className="flex gap-2">
              <Input
                id="yt-video-id"
                placeholder="np. https://youtube.com/watch?v=abc lub abc"
                value={ytVideoId}
                onChange={(e: { target: { value: string } }) => setYtVideoId(e.target.value)}
                onKeyDown={(e: { key: string }) => e.key === "Enter" && handleAddYoutube()}
              />
              <Button onClick={handleAddYoutube} disabled={!ytVideoId.trim() || loading === "add-yt"}>
                {loading === "add-yt" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
