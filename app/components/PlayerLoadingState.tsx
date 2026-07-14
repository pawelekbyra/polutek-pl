"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { cn } from "@/lib/utils";

interface PlayerLoadingStateProps {
  className?: string;
  fill?: boolean;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
}

/**
 * Bar + label shown while the player prepares content. Shared between the
 * standalone access-check state below and the bare overlay VideoPlayer keeps
 * on top of the mounted media element until the first real frame renders, so
 * both loading phases read as one continuous indicator instead of two.
 */
export function PlayerLoadingIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn("polutek-player-loader", compact && "polutek-player-loader--compact")}
      role="status"
      aria-live="polite"
    >
      <div className="polutek-player-loader-mark" aria-hidden="true">
        <LoaderCircle />
      </div>
      <div className="polutek-player-loader-track" aria-hidden="true">
        <div className="polutek-player-loader-progress" />
      </div>
      {!compact && (
        <p className="polutek-player-loader-label">
          Już podaję film…
        </p>
      )}
      <style jsx global>{`
        .polutek-player-loader { position:relative; display:flex; width:100%; height:100%; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:13px; overflow:hidden; color:#171717; background:radial-gradient(circle at 50% 42%,rgba(37,99,235,.1),transparent 34%),var(--chan-nav,#f7f1e4); font-family:var(--font-space-grotesk,sans-serif); }
        .polutek-player-loader::before { content:""; position:absolute; inset:12px; border:1px solid rgba(23,23,23,.1); border-radius:16px; }
        .polutek-player-loader--compact { min-height:0; gap:8px; }
        .polutek-player-loader--compact::before { inset:5px; border-radius:9px; }
        .polutek-player-loader-mark { position:relative; display:grid; width:52px; height:52px; place-items:center; border:1px solid rgba(37,99,235,.2); border-radius:15px; background:#fff; color:#2563eb; box-shadow:0 12px 30px rgba(37,99,235,.14); }
        .polutek-player-loader-mark svg { width:24px; height:24px; animation:polutek-loader-spin .9s linear infinite; }
        .polutek-player-loader--compact .polutek-player-loader-mark { width:34px; height:34px; border-radius:10px; }
        .polutek-player-loader--compact .polutek-player-loader-mark svg { width:17px; height:17px; }
        .polutek-player-loader-track { position:relative; width:min(168px,45%); height:4px; overflow:hidden; border-radius:999px; background:rgba(37,99,235,.14); }
        .polutek-player-loader--compact .polutek-player-loader-track { width:64px; height:3px; }
        .polutek-player-loader-progress { position:absolute; inset:0 auto 0 -38%; width:38%; border-radius:999px; background:#2563eb; animation:polutek-loader-sweep 1.05s ease-in-out infinite; }
        .polutek-player-loader-label { position:relative; margin:0; color:#4b5563; font-size:12px; font-weight:700; letter-spacing:.01em; }
        @keyframes polutek-loader-sweep { 0% { transform:translateX(0); } 100% { transform:translateX(365%); } }
        @keyframes polutek-loader-spin { to { transform:rotate(360deg); } }
        @media (max-width:640px) { .polutek-player-loader { min-height:0; gap:10px; } .polutek-player-loader-mark { width:44px; height:44px; } .polutek-player-loader-label { font-size:11px; } }
        @media (prefers-reduced-motion:reduce) { .polutek-player-loader-mark svg { animation-duration:1.8s; } .polutek-player-loader-progress { animation-duration:2s; } }
      `}</style>
    </div>
  );
}

/**
 * Unified loading state for the video player area.
 * Uses a stable poster-like frame rather than a skeleton so app-level
 * preloading can keep video switches feeling immediate.
 */
export function PlayerLoadingState({
  className,
  fill = false,
  variant = "default",
}: PlayerLoadingStateProps) {
  const isThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";

  return (
    <PlayerStateFrame
      className={cn(className, isThumbnail ? "rounded-lg" : undefined)}
      fill={fill || variant === "thumbnailCompact"}
    >
      <PlayerLoadingIndicator compact={isThumbnail} />
    </PlayerStateFrame>
  );
}
