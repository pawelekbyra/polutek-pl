"use client";

import React, { useEffect, useState } from "react";
import { useAppPreload } from "./AppPreloadProvider";

export function PreloadProgressBar() {
  const preloader = useAppPreload();
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    function handleProgress(event: CustomEvent<{ progress: number; ready: boolean }>) {
      setProgress(event.detail.progress);
      setIsReady(event.detail.ready);
    }

    window.addEventListener("polutek:app-preload-progress", handleProgress as EventListener);
    return () => window.removeEventListener("polutek:app-preload-progress", handleProgress as EventListener);
  }, []);

  if (!preloader || isReady) return null;

  return (
    <div
      className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-[var(--chan-blue)] to-[var(--chan-amber-bright)] z-[9999] transition-all duration-300 ease-out"
      style={{
        width: `${Math.min(progress, 99)}%`,
        opacity: progress > 0 && progress < 100 ? 1 : 0,
      }}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Ładowanie aplikacji"
    />
  );
}
