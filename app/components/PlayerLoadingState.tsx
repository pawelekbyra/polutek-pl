"use client";

import React from "react";
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
        <span className="polutek-player-loader-play" />
        <span className="polutek-player-loader-spark polutek-player-loader-spark--one" />
        <span className="polutek-player-loader-spark polutek-player-loader-spark--two" />
      </div>
      <div className="polutek-player-loader-track" aria-hidden="true">
        <div className="polutek-player-loader-scribble" />
      </div>
      {!compact && (
        <p className="polutek-player-loader-label">
          Już podaję film…
        </p>
      )}
      <style jsx global>{`
        .polutek-player-loader { position:relative; display:flex; width:100%; height:100%; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:13px; overflow:hidden; color:#171717; background:radial-gradient(circle at 24% 20%,rgba(37,99,235,.2),transparent 25%),radial-gradient(circle at 78% 75%,rgba(250,204,21,.2),transparent 28%),#fff8e8; font-family:var(--font-space-grotesk,sans-serif); }
        .polutek-player-loader::before { content:""; position:absolute; inset:12px; border:1.5px solid rgba(23,23,23,.14); border-radius:18px 13px 20px 12px; transform:rotate(-.25deg); }
        .polutek-player-loader--compact { min-height:0; gap:8px; }
        .polutek-player-loader--compact::before { inset:5px; border-radius:10px 7px 11px 6px; }
        .polutek-player-loader-mark { position:relative; display:grid; width:52px; height:52px; place-items:center; border:2px solid #171717; border-radius:46% 54% 43% 57% / 55% 45% 56% 44%; background:#fffdf6; box-shadow:4px 4px 0 #2563eb; transform:rotate(-2deg); animation:polutek-loader-bob 1.35s ease-in-out infinite; }
        .polutek-player-loader--compact .polutek-player-loader-mark { width:34px; height:34px; border-width:1.5px; box-shadow:3px 3px 0 #2563eb; }
        .polutek-player-loader-play { width:0; height:0; margin-left:4px; border-top:9px solid transparent; border-bottom:9px solid transparent; border-left:14px solid #171717; filter:drop-shadow(1px 1px 0 rgba(37,99,235,.35)); transform:rotate(2deg); }
        .polutek-player-loader--compact .polutek-player-loader-play { border-top-width:6px; border-bottom-width:6px; border-left-width:10px; }
        .polutek-player-loader-spark { position:absolute; width:11px; height:6px; border-top:2px solid #171717; border-radius:50%; }
        .polutek-player-loader-spark--one { right:-18px; top:2px; transform:rotate(-28deg); }
        .polutek-player-loader-spark--two { left:-18px; bottom:4px; transform:rotate(-32deg); }
        .polutek-player-loader-track { position:relative; width:min(168px,45%); height:9px; overflow:hidden; border:1.5px solid #171717; border-radius:53% 47% 55% 45% / 60% 45% 55% 40%; background:rgba(255,255,255,.72); box-shadow:2px 2px 0 rgba(23,23,23,.12); transform:rotate(.4deg); }
        .polutek-player-loader--compact .polutek-player-loader-track { width:64px; height:6px; border-width:1px; }
        .polutek-player-loader-scribble { position:absolute; inset:-2px auto -2px -42%; width:42%; border-radius:48% 52% 45% 55%; background:#2563eb; box-shadow:inset 0 2px 0 rgba(255,255,255,.24); animation:polutek-loader-sweep 1.15s ease-in-out infinite; }
        .polutek-player-loader-label { position:relative; margin:0; color:#34302a; font-size:12px; font-weight:800; letter-spacing:.035em; transform:rotate(-.5deg); }
        @keyframes polutek-loader-sweep { 0% { transform:translateX(0) skewX(-8deg); } 100% { transform:translateX(345%) skewX(8deg); } }
        @keyframes polutek-loader-bob { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-3px) rotate(1deg); } }
        @media (max-width:640px) { .polutek-player-loader { min-height:0; gap:10px; } .polutek-player-loader-mark { width:44px; height:44px; } .polutek-player-loader-label { font-size:11px; } }
        @media (prefers-reduced-motion:reduce) { .polutek-player-loader-mark { animation:none; } .polutek-player-loader-scribble { animation-duration:2s; } }
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
