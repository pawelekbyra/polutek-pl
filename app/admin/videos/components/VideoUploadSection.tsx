"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, X, RotateCcw, AlertCircle, CheckCircle2, Loader2, FileVideo } from "@/app/components/icons";
import { useToast } from "@/app/hooks/useToast";
import { readAdminApiError } from "./api-error";

interface VideoUploadSectionProps {
  videoId: string;
  onUploadComplete: () => void;
  initialAsset?: any;
  initialFile?: File | null;
  autoStart?: boolean;
  onUploadReady?: () => void;
  publishAfterReady?: boolean;
}

export function VideoUploadSection({ videoId, onUploadComplete, initialAsset, initialFile = null, autoStart = false, onUploadReady, publishAfterReady = false }: VideoUploadSectionProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [upload, setUpload] = useState<tus.Upload | null>(null);
  const [progress, setProgress] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [status, setStatus] = useState<"IDLE" | "PROVISIONING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "CANCELLED" | "PROCESSING_TIMEOUT">("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<any>(initialAsset);
  const toast = useToast();
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const autoStartedRef = useRef(false);

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
            onUploadReady?.();
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
      setError(publishAfterReady
        ? "Cloudflare nadal przetwarza wideo. Szkic i intencja publikacji są zapisane; backend opublikuje film automatycznie po READY albo zapisze błąd wymagający interwencji."
        : "Cloudflare nadal przetwarza wideo. Szkic jest zapisany; wróć do szczegółów filmu i zsynchronizuj status później.");
    }, 5 * 60 * 1000);
    return () => clearTimeout(timeoutId);
  }, [videoId, onUploadComplete, onUploadReady, publishAfterReady, stopPolling]);

  useEffect(() => {
    if (initialAsset) {
      setAsset(initialAsset);
      if (initialAsset.processingState === "READY") setStatus("READY");
      else if (initialAsset.processingState === "FAILED") setStatus("FAILED");
      else if (initialAsset.processingState === "PROCESSING" || initialAsset.processingState === "UPLOADING" || initialAsset.processingState === "PENDING") {
          setStatus(initialAsset.processingState === "PENDING" ? "IDLE" : initialAsset.processingState);
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
      const provRes = await fetch(`/api/admin/videos/${videoId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type })
      });
      if (!provRes.ok) {
        const errData = await provRes.json();
        throw new Error(readAdminApiError(errData, "Failed to provision upload"));
      }
      const { uploadUrl } = await provRes.json();
      const tusUpload = new tus.Upload(file, {
        endpoint: uploadUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: { filename: file.name, filetype: file.type },
        onError: (err) => { setError(err.message); setStatus("FAILED"); },
        onProgress: (bytesSent, total) => { setBytesUploaded(bytesSent); setBytesTotal(total); setProgress(Math.round((bytesSent / total) * 100)); },
        onSuccess: () => { setStatus("PROCESSING"); toast("Upload zakończony pomyślnie. Trwa przetwarzanie...", "success"); startPolling(); }
      });
      setUpload(tusUpload);
      setStatus("UPLOADING");
      tusUpload.start();
    } catch (err: any) {
      setError(err.message);
      setStatus("FAILED");
      toast(err.message, "error");
    }
  }, [file, startPolling, toast, videoId]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !file || status !== "IDLE") return;
    autoStartedRef.current = true;
    startUpload();
  }, [autoStart, file, startUpload, status]);

  const cancelUpload = () => { if (upload) { upload.abort(); setUpload(null); } setStatus("CANCELLED"); stopPolling(); };
  const retryUpload = () => { setStatus("IDLE"); setError(null); setProgress(0); startUpload(); };
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className="shadow-sm">
      <CardHeader><div className="flex justify-between items-center"><div><CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5" /> Cloudflare Stream Upload</CardTitle><CardDescription>Prześlij plik wideo bezpośrednio do Cloudflare.</CardDescription></div><Badge variant={status === "READY" ? "default" : (status === "FAILED" ? "destructive" : "outline")}>{status}</Badge></div></CardHeader>
      <CardContent className="space-y-6">
        {status === "IDLE" || status === "CANCELLED" || status === "FAILED" ? (
          <div className="space-y-4"><div className="border-2 border-dashed rounded-xl p-8 text-center space-y-4 bg-muted/20"><input type="file" accept="video/*" onChange={handleFileChange} className="hidden" id="video-file-input" /><label htmlFor="video-file-input" className="cursor-pointer flex flex-col items-center gap-3"><div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary"><FileVideo className="h-6 w-6" /></div><div><p className="font-bold text-sm">{file ? file.name : "Kliknij, aby wybrać plik"}</p><p className="text-xs text-muted-foreground">{file ? formatBytes(file.size) : "MP4, MOV, WebM (max 10GB)"}</p></div></label></div>{file && (status === "IDLE" || status === "CANCELLED" || status === "FAILED") && (<Button className="w-full" onClick={startUpload}>Rozpocznij Upload</Button>)}</div>
        ) : null}
        {(status === "UPLOADING" || status === "PROVISIONING" || status === "PROCESSING") && (
          <div className="space-y-4"><div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2">{status === "PROCESSING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{status === "PROVISIONING" ? "Inicjowanie..." : status === "UPLOADING" ? "Przesyłanie..." : "Przetwarzanie..."}</span><span className="font-mono">{progress}%</span></div><Progress value={progress} className="h-2" /><div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider"><span>{formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)}</span>{status === "UPLOADING" && (<Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={cancelUpload}><X className="mr-1 h-3 w-3" /> Anuluj</Button>)}</div></div>
        )}
        {status === "READY" && (<div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3 text-green-800"><CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /><div><p className="font-bold text-sm">Wideo gotowe!</p><p className="text-xs opacity-80">Zasób Cloudflare jest gotowy do publikacji.</p></div></div>)}
        {status === "PROCESSING_TIMEOUT" && error && (<div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-amber-900"><AlertCircle className="h-5 w-5 shrink-0 text-amber-600" /><div className="flex-1"><p className="font-bold text-sm">Przetwarzanie trwa dłużej niż zwykle</p><p className="text-xs opacity-80">{error}</p></div></div>)}
        {status === "FAILED" && error && (<div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800"><AlertCircle className="h-5 w-5 shrink-0 text-red-600" /><div className="flex-1"><p className="font-bold text-sm">Błąd przesyłania</p><p className="text-xs opacity-80 mb-3">{error}</p><Button variant="outline" size="sm" className="h-7 text-xs bg-white" onClick={retryUpload}><RotateCcw className="mr-1 h-3 w-3" /> Spróbuj ponownie</Button></div></div>)}
        {asset && asset.provider === "CLOUDFLARE_STREAM" && (<div className="pt-4 border-t space-y-2"><div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold"><span>UID: {asset.providerAssetId}</span><span>Stan: {asset.processingState}</span></div></div>)}
      </CardContent>
    </Card>
  );
}
