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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    const res = await fetch(`/api/admin/videos/${video.id}/sources/${assetId}`, { method: "DELETE" });
    if (res.ok) {
      onToast("Źródło zostało usunięte.", "success");
      setConfirmDeleteId(null);
      onRefresh();
    } else {
      const data = await res.json();
      onToast(`Błąd: ${data?.error?.message || data?.message || "Nieznany błąd"}`, "error");
    }
  }

  return (
    <Card className="shadow-sm border-neutral-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Źródła wideo</CardTitle>
          <CardDescription>Zarządzaj wieloma źródłami dla tego filmu.</CardDescription>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => setShowAddForm("CLOUDFLARE_STREAM")}>
             <Plus className="w-3 h-3 mr-1" /> Cloudflare
           </Button>
           {!isPatron && (
             <Button variant="outline" size="sm" onClick={() => setShowAddForm("YOUTUBE")}>
               <Youtube className="w-3 h-3 mr-1" /> YouTube
             </Button>
           )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <div className="p-4 border rounded-xl bg-muted/30 space-y-4 animate-in fade-in slide-in-from-top-2">
            <h4 className="font-bold text-sm">Dodaj nowe źródło: {PROVIDER_LABELS[showAddForm]}</h4>
            {showAddForm === "CLOUDFLARE_STREAM" ? (
              <div className="space-y-2">
                <Label htmlFor="cf-uid">Cloudflare UID</Label>
                <Input id="cf-uid" value={cfUid} onChange={(e) => setCfUid(e.target.value)} placeholder="np. fc7a20a..." />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="yt-url">Link YouTube</Label>
                <Input id="yt-url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddSource} disabled={submitting}>
                {submitting ? "Dodawanie..." : "Dodaj"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(null)}>Anuluj</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-neutral-50 border">
                  {asset.provider === "YOUTUBE" ? <Youtube className="w-4 h-4 text-red-600" /> : <Video className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{PROVIDER_LABELS[asset.provider] || asset.provider}</span>
                    <Badge variant={STATE_VARIANT[asset.processingState] || "outline"} className="text-[10px] h-4">
                      {asset.processingState}
                    </Badge>
                    {asset.isPrimary && <Badge variant="default" className="text-[10px] h-4 bg-amber-500 hover:bg-amber-600 border-0"><Star className="w-2.5 h-2.5 mr-0.5 fill-current" /> Główne</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {asset.providerAssetId || asset.externalVideoId || asset.id}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {asset.provider === "CLOUDFLARE_STREAM" && (
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSyncCloudflare} title="Synchronizuj status">
                     <RotateCcw className="w-4 h-4" />
                   </Button>
                )}
                {!asset.isPrimary && asset.processingState === "READY" && asset.isPlayable && (
                   <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleMakePrimary(asset.id)}>
                     Ustaw jako główne
                   </Button>
                )}
                {!asset.isPrimary && (
                   confirmDeleteId === asset.id ? (
                     <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => handleDelete(asset.id)}>Tak, usuń</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setConfirmDeleteId(null)}>Nie</Button>
                     </div>
                   ) : (
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDeleteId(asset.id)}>
                       <Trash2 className="w-4 h-4" />
                     </Button>
                   )
                )}
              </div>
            </div>
          ))}
          {assets.length === 0 && (
            <div className="py-8 text-center border-2 border-dashed rounded-xl opacity-40">
              <p className="text-sm italic">Brak dodatkowych źródeł wideo.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
