"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Plus, RotateCcw, Star, Trash2, XCircle } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";

type SourceDto = {
  id: string;
  provider: string;
  processingState: string;
  isPrimary: boolean;
  providerAssetId?: string | null;
  externalVideoId?: string | null;
  externalUrl?: string | null;
  objectKey?: string | null;
  failureReason?: string | null;
  createdAt: string;
};

interface VideoSourcesPanelProps {
  videoId: string;
  videoTier: string;
  sources: SourceDto[];
  onRefresh: () => void;
}

type ProviderOption = "CLOUDFLARE_STREAM" | "YOUTUBE" | "R2" | "MUX";

const PROVIDER_LABELS: Record<string, string> = {
  CLOUDFLARE_STREAM: "Cloudflare Stream",
  YOUTUBE: "YouTube",
  R2: "Cloudflare R2",
  MUX: "Mux",
};

const STATE_VARIANT: Record<string, "default" | "outline" | "destructive" | "secondary"> = {
  READY: "default",
  PROCESSING: "secondary",
  UPLOADING: "secondary",
  PENDING: "outline",
  FAILED: "destructive",
};

export function VideoSourcesPanel({ videoId, videoTier, sources, onRefresh }: VideoSourcesPanelProps) {
  const [showForm, setShowForm] = useState<boolean>(false);
  const [provider, setProvider] = useState<ProviderOption>("CLOUDFLARE_STREAM");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const toast = useToast();

  const field = (name: string) => ({
    value: formData[name] || "",
    onChange: (e: { target: { value: string } }) =>
      setFormData((prev: Record<string, string>) => ({ ...prev, [name]: e.target.value })),
  });

  const apiBase = `/api/admin/videos/${videoId}/sources`;

  const handleAdd = async () => {
    setIsSaving(true);
    try {
      let body: Record<string, string> = { provider };
      if (provider === "YOUTUBE") body.youtubeUrl = formData.youtubeUrl || "";
      else if (provider === "CLOUDFLARE_STREAM") { body.providerAssetId = formData.providerAssetId || ""; body.providerPlaybackId = formData.providerPlaybackId || ""; }
      else if (provider === "R2") { body.bucket = formData.bucket || ""; body.objectKey = formData.objectKey || ""; }
      else if (provider === "MUX") body.providerAssetId = formData.providerAssetId || "";

      const res = await fetch(apiBase, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast("Źródło dodane.", "success");
        setShowForm(false);
        setFormData({});
        onRefresh();
      } else {
        const err = await res.json();
        toast(err.error?.message || err.message || "Błąd dodawania źródła.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (assetId: string, action: "make-primary" | "sync" | "delete") => {
    setActionInProgress(assetId + action);
    try {
      if (action === "delete") {
        const res = await fetch(`${apiBase}/${assetId}`, { method: "DELETE" });
        if (res.ok) { toast("Źródło usunięte.", "success"); onRefresh(); }
        else { const err = await res.json(); toast(err.error?.message || "Błąd usuwania.", "error"); }
      } else {
        const res = await fetch(`${apiBase}/${assetId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
        if (res.ok) { toast(action === "make-primary" ? "Aktywne źródło zmienione." : "Zsynchronizowano.", "success"); onRefresh(); }
        else { const err = await res.json(); toast(err.error?.message || "Błąd akcji.", "error"); }
      }
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Źródła wideo</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> Dodaj źródło
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="flex flex-wrap gap-2">
                {(["CLOUDFLARE_STREAM", "YOUTUBE", "R2", "MUX"] as ProviderOption[]).map((p) => (
                  <Button key={p} size="sm" variant={provider === p ? "default" : "outline"} onClick={() => setProvider(p)}>
                    {PROVIDER_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>
            {provider === "YOUTUBE" && (
              <>
                <div className="space-y-1">
                  <Label>URL YouTube</Label>
                  <Input placeholder="https://youtube.com/watch?v=..." {...field("youtubeUrl")} />
                </div>
                {videoTier === "PATRON" && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>YouTube nie może być aktywnym źródłem dla filmów PATRON. Możesz dodać je jako backup, ale nie ustawisz go jako aktywne.</p>
                  </div>
                )}
              </>
            )}
            {provider === "CLOUDFLARE_STREAM" && (
              <>
                <div className="space-y-1">
                  <Label>Cloudflare Stream UID</Label>
                  <Input placeholder="abc123..." {...field("providerAssetId")} />
                </div>
                <div className="space-y-1">
                  <Label>Playback ID (opcjonalnie)</Label>
                  <Input placeholder="Zostaw puste = taki sam jak UID" {...field("providerPlaybackId")} />
                </div>
              </>
            )}
            {provider === "R2" && (
              <>
                <div className="space-y-1">
                  <Label>Bucket</Label>
                  <Input placeholder="my-bucket" {...field("bucket")} />
                </div>
                <div className="space-y-1">
                  <Label>Object Key</Label>
                  <Input placeholder="videos/filename.mp4" {...field("objectKey")} />
                </div>
              </>
            )}
            {provider === "MUX" && (
              <div className="space-y-1">
                <Label>Mux Asset ID</Label>
                <Input placeholder="mux_asset_id..." {...field("providerAssetId")} />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAdd} disabled={isSaving}>{isSaving ? "Dodawanie..." : "Dodaj"}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setFormData({}); }}>Anuluj</Button>
            </div>
          </div>
        )}

        {sources.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-8">Brak źródeł. Dodaj pierwsze źródło powyżej.</p>
        )}

        <div className="space-y-3">
          {sources.map((source) => {
            const isYoutubePatron = source.provider === "YOUTUBE" && videoTier === "PATRON";
            const canMakePrimary = source.processingState === "READY" && !source.isPrimary && !isYoutubePatron;
            return (
              <div key={source.id} className={`rounded-xl border p-4 space-y-3 ${source.isPrimary ? "border-green-300 bg-green-50/40" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{PROVIDER_LABELS[source.provider] || source.provider}</Badge>
                    <Badge variant={STATE_VARIANT[source.processingState] || "outline"}>{source.processingState}</Badge>
                    {source.isPrimary && <Badge className="bg-green-600 text-white gap-1"><Star className="h-3 w-3" /> Aktywne</Badge>}
                  </div>
                  <div className="flex gap-1">
                    {source.provider === "CLOUDFLARE_STREAM" && (
                      <Button size="sm" variant="ghost" className="h-7 text-[10px]" disabled={actionInProgress !== null}
                        onClick={() => handleAction(source.id, "sync")}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Sync
                      </Button>
                    )}
                    {canMakePrimary && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={actionInProgress !== null}
                        onClick={() => handleAction(source.id, "make-primary")}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Ustaw aktywne
                      </Button>
                    )}
                    {!source.isPrimary && (
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive hover:text-destructive" disabled={actionInProgress !== null}
                        onClick={() => handleAction(source.id, "delete")}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
                  {source.providerAssetId && <p>UID: {source.providerAssetId}</p>}
                  {source.externalVideoId && <p>YouTube ID: {source.externalVideoId}</p>}
                  {source.objectKey && !source.providerAssetId && !source.externalVideoId && <p>Key: {source.objectKey}</p>}
                  {source.externalUrl && (
                    <a href={source.externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      {source.externalUrl}
                    </a>
                  )}
                </div>
                {isYoutubePatron && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> Nie można ustawić YouTube jako aktywne dla PATRON
                  </div>
                )}
                {source.failureReason && (
                  <div className="flex items-center gap-1 text-[10px] text-red-700">
                    <XCircle className="h-3 w-3" /> {source.failureReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
