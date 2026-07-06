"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Edit } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { CoverImageUpload } from "./CoverImageUpload";
import { VideoMediaManager } from "./media/VideoMediaManager";
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

export function VideoStudio({ videoId, initialVideo, onSaved }: VideoStudioProps) {
  const toast = useToast();
  const [thumbnailUrl, setThumbnailUrl] = useState(initialVideo.thumbnailUrl ?? "");
  const assets = initialVideo.assets ?? [];

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

  return (
    <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_360px] md:p-6">
      <VideoMediaManager videoId={videoId} assets={assets} tier={initialVideo.tier} onChanged={onSaved} />

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
                Tytuł, opis i ustawienia dostępu są zarządzane w głównym formularzu edycji filmu.
            </p>
        </div>
      </div>
    </div>
  );
}
