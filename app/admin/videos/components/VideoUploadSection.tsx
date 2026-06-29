"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, X, RotateCcw, AlertCircle, CheckCircle2, Loader2, FileVideo } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";

interface VideoUploadSectionProps {
  videoId: string;
  onUploadComplete: () => void;
  initialAsset?: any;
  initialFile?: File | null;
  autoStart?: boolean;
  onUploadReady?: () => void;
  publishAfterReady?: boolean;
  preferredProvider?: string;
}

export function VideoUploadSection({
  videoId,
  onUploadComplete,
  initialAsset,
  initialFile = null,
  autoStart = false,
  onUploadReady,
  publishAfterReady = false,
  preferredProvider = "CLOUDFLARE_STREAM",
}: VideoUploadSectionProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [progress, setProgress] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [status, setStatus] = useState<"IDLE" | "PROVISIONING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "CANCELLED" | "PROCESSING_TIMEOUT">("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<any>(initialAsset);
  const toast = useToast();
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const autoStartedRef = useRef(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingInterval.current) return;
    setStatus("PROCESSING");
    pollingInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/videos/${videoId}`);
        if (res.ok) {
          const data = await res.json();
          setAsset(data.asset);
          if (data.asset?.processingState === "READY") {
            setStatus("READY");
            stopPolling();
            onUploadComplete();
          } else if (data.asset?.processingState === "FAILED") {
            setStatus("FAILED");
            setError(data.asset.failureReason || "Processing failed");
            stopPolling();
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 5000);

    const timeoutId = setTimeout(() => {
      stopPolling();
      setStatus((current) => current === "PROCESSING" ? "PROCESSING_TIMEOUT" : current);
      setError(
        publishAfterReady
          ? "Provider nadal przetwarza wideo. Szkic i intencja publikacji są zapisane; backend opublikuje film automatycznie po READY albo zapisze błąd wymagający interwencji."
          : "Provider nadal przetwarza wideo. Szkic jest zapisany; wróć do szczegółów filmu i zsynchronizuj status później."
      );
    }, 5 * 60 * 1000);
    return () => clearTimeout(timeoutId);
  }, [videoId, onUploadComplete, publishAfterReady, stopPolling]);

  useEffect(() => {
    if (initialAsset) {
      setAsset(initialAsset);
      if (initialAsset.processingState === "READY") {
        setStatus("READY");
      } else if (initialAsset.processingState === "FAILED") {
        setStatus("FAILED");
        setError(initialAsset.failureReason);
      } else if (["PROCESSING", "UPLOADING", "PENDING"].includes(initialAsset.processingState)) {
        setStatus(initialAsset.processingState === "PENDING" ? "PROCESSING" : initialAsset.processingState as any);
        startPolling();
      }
    }
    return () => stopPolling();
  }, [initialAsset, startPolling, stopPolling]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setStatus("IDLE");
      setProgress(0);
    }
  };

  const startUpload = useCallback(async () => {
    if (!file) return;
    setStatus("PROVISIONING");
    setError(null);
    try {
      onUploadReady?.();

      const provisionRes = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type || "video/mp4" }),
      });
      if (!provisionRes.ok) {
        const body = await provisionRes.json().catch((): unknown => null);
        throw new Error((body as any)?.error || "Nie udało się przygotować uploadu.");
      }
      const provision = await provisionRes.json() as { uploadUrl: string; originalId: string };

      setStatus("UPLOADING");
      setBytesTotal(file.size);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setBytesUploaded(e.loaded);
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload do R2 nieudany (HTTP ${xhr.status}).`));
        });
        xhr.addEventListener("error", () => reject(new Error("Błąd sieci podczas uploadu.")));
        xhr.addEventListener("abort", () => reject(new Error("Upload anulowany.")));
        xhr.open("PUT", provision.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      const completeRes = await fetch(`/api/admin/videos/${videoId}/original-upload`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalId: provision.originalId,
          mirrorPlan: { mux: true, cloudflare: true },
          preferredProvider,
        }),
      });
      if (!completeRes.ok) {
        const body = await completeRes.json().catch((): unknown => null);
        throw new Error((body as any)?.error || "Nie udało się uruchomić mirrorów.");
      }

      toast("Upload zakończony. Trwa przetwarzanie przez " + (preferredProvider === "MUX" ? "Mux" : "Cloudflare Stream") + "...", "success");
      startPolling();
    } catch (err: any) {
      if (err.message === "Upload anulowany.") {
        setStatus("CANCELLED");
        return;
      }
      setError(err.message);
      setStatus("FAILED");
      toast(err.message, "error");
    }
  }, [file, videoId, preferredProvider, onUploadReady, startPolling, toast]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !file || status !== "IDLE") return;
    autoStartedRef.current = true;
    startUpload();
  }, [autoStart, file, startUpload, status]);

  const cancelUpload = () => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    stopPolling();
  };

  const retryUpload = () => {
    setStatus("IDLE");
    setError(null);
    setProgress(0);
    startUpload();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const providerLabel = preferredProvider === "MUX" ? "Mux" : "Cloudflare Stream";

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5" /> Upload wideo</CardTitle>
            <CardDescription>Plik trafi do R2, następnie zostanie zmirrorowany na Cloudflare Stream i Mux. Primary: {providerLabel}.</CardDescription>
          </div>
          <Badge variant={status === "READY" ? "default" : (status === "FAILED" ? "destructive" : "outline")}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(status === "IDLE" || status === "CANCELLED" || status === "FAILED") ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-4 bg-muted/20">
              <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" id="video-file-input" />
              <label htmlFor="video-file-input" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary"><FileVideo className="h-6 w-6" /></div>
                <div>
                  <p className="font-bold text-sm">{file ? file.name : "Kliknij, aby wybrać plik"}</p>
                  <p className="text-xs text-muted-foreground">{file ? formatBytes(file.size) : "MP4, MOV, WebM (max 10GB)"}</p>
                </div>
              </label>
            </div>
            {file && <Button className="w-full" onClick={startUpload}>Rozpocznij Upload</Button>}
          </div>
        ) : null}
        {(status === "UPLOADING" || status === "PROVISIONING" || status === "PROCESSING") && (
          <div className="space-y-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                {status === "PROCESSING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {status === "PROVISIONING" ? "Inicjowanie..." : status === "UPLOADING" ? "Przesyłanie do R2..." : `Przetwarzanie przez ${providerLabel}...`}
              </span>
              <span className="font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              <span>{formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)}</span>
              {status === "UPLOADING" && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={cancelUpload}><X className="mr-1 h-3 w-3" /> Anuluj</Button>
              )}
            </div>
          </div>
        )}
        {status === "READY" && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3 text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-bold text-sm">Wideo gotowe!</p>
              <p className="text-xs opacity-80">
                {publishAfterReady
                  ? `Asset ${providerLabel} jest gotowy. Backend przetwarza teraz automatyczną publikację.`
                  : `Asset ${providerLabel} jest gotowy do publikacji.`}
              </p>
            </div>
          </div>
        )}
        {status === "PROCESSING_TIMEOUT" && error && (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-amber-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1"><p className="font-bold text-sm">Przetwarzanie trwa dłużej niż zwykle</p><p className="text-xs opacity-80">{error}</p></div>
          </div>
        )}
        {status === "FAILED" && error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="font-bold text-sm">Błąd przesyłania</p>
              <p className="text-xs opacity-80 mb-3">{error}</p>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-white" onClick={retryUpload}><RotateCcw className="mr-1 h-3 w-3" /> Spróbuj ponownie</Button>
            </div>
          </div>
        )}
        {asset && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold">
              <span>Provider: {asset.provider?.replace(/_/g, " ")}</span>
              <span>Stan: {asset.processingState}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
