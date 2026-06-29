"use client";

import React, { useState } from "react";
import { Download, X, Smartphone, Monitor, AlertCircle, Loader2 } from "lucide-react";

interface DownloadSheetProps {
  videoId: string;
  videoTitle: string;
  language: string;
  onClose: () => void;
}

type DownloadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; url: string; isHls: boolean }
  | { phase: "error" };

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function DownloadSheet({ videoId, videoTitle, language, onClose }: DownloadSheetProps) {
  const isPl = language === "pl";
  const [state, setState] = useState<DownloadState>({ phase: "idle" });
  const isIos = detectIos();

  async function fetchDownloadUrl() {
    setState({ phase: "loading" });
    try {
      const res = await fetch(`/api/media-source/${videoId}`);
      if (!res.ok) throw new Error("no_access");
      const data = await res.json();
      const url: string | undefined = data.playbackUrl;
      if (!url) throw new Error("no_url");
      const isHls = url.includes(".m3u8") || url.includes("manifest");
      setState({ phase: "ready", url, isHls });
    } catch {
      setState({ phase: "error" });
    }
  }

  React.useEffect(() => {
    fetchDownloadUrl();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  function triggerDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = videoTitle + ".mp4";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-[24px] sm:rounded-[20px] shadow-2xl p-6 pb-8 sm:pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[11px] bg-neutral-100 flex items-center justify-center shrink-0">
              <Download size={18} className="text-neutral-700" />
            </div>
            <div>
              <h3 className="font-heading text-[16px] font-bold text-[#0f0f0f] leading-tight">
                {isPl ? "Pobierz wideo" : "Download video"}
              </h3>
              <p className="text-[12px] text-muted-foreground line-clamp-1 mt-[1px]">
                {videoTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors shrink-0"
          >
            <X size={14} className="text-neutral-600" />
          </button>
        </div>

        {/* Content */}
        {state.phase === "loading" && (
          <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[14px]">{isPl ? "Sprawdzam dostęp…" : "Checking access…"}</span>
          </div>
        )}

        {state.phase === "error" && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-[12px] p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-[13px] text-red-700">
              {isPl
                ? "Nie możemy pobrać tego wideo. Sprawdź czy masz dostęp do materiału."
                : "Cannot download this video. Check if you have access."}
            </p>
          </div>
        )}

        {state.phase === "ready" && (
          <div className="space-y-4">
            {/* iOS instructions */}
            {(isIos || state.isHls) && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-[14px] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone size={15} className="text-neutral-500" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                    {isPl ? "Instrukcja dla iPhone" : "iPhone instructions"}
                  </span>
                </div>
                <ol className="space-y-[10px]">
                  {(isPl ? [
                    "Otwórz wideo na pełnym ekranie i zacznij odtwarzanie",
                    "Naciśnij i przytrzymaj obraz wideo przez 2 sekundy",
                    'Wybierz "Pobierz wideo" z menu które się pojawi',
                    'Jeśli opcja niedostępna — dotknij ikony Udostępnij (kwadrat ze strzałką), wybierz "Zapisz w Plikach"',
                  ] : [
                    "Open the video fullscreen and start playing",
                    "Press and hold the video for 2 seconds",
                    'Choose "Download Video" from the menu',
                    'If unavailable — tap the Share icon (square with arrow), choose "Save to Files"',
                  ]).map((step, i) => (
                    <li key={i} className="flex gap-3 text-[13px] text-[#3a3a3a] leading-[1.45]">
                      <span className="w-5 h-5 rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-600 flex items-center justify-center shrink-0 mt-[1px]">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Direct download for non-HLS or desktop */}
            {!state.isHls && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor size={15} className="text-neutral-500" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                    {isPl ? "Bezpośrednie pobieranie" : "Direct download"}
                  </span>
                </div>
                <button
                  onClick={() => triggerDownload(state.url)}
                  className="w-full h-[44px] rounded-[11px] bg-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all"
                >
                  <Download size={16} />
                  {isPl ? "Pobierz plik" : "Download file"}
                </button>
              </div>
            )}

            {/* HLS note for non-iOS */}
            {state.isHls && !isIos && (
              <div className="bg-amber-50 border border-amber-100 rounded-[12px] p-4">
                <p className="text-[13px] text-amber-800 leading-[1.5]">
                  {isPl
                    ? "To wideo jest streamowane. Na komputerze możesz użyć narzędzi takich jak yt-dlp lub pobierz je przez iPhone powyższą instrukcją."
                    : "This video is streamed. On desktop you can use tools like yt-dlp, or download it on iPhone using the instructions above."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
