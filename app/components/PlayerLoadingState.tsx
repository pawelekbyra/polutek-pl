"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { cn } from "@/lib/utils";
import { useOptionalTx } from "@/lib/i18n/language-context";

interface PlayerLoadingStateProps {
  className?: string;
  fill?: boolean;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
}

/**
 * Start-up view of the full-size player: the player's own dark frame, never the cover image
 * (covers belong to thumbnails and the playlist only), with a small spinner that fades in only
 * if the start takes longer than ~0.45 s, so fast switches (the common case, thanks to intent
 * warm-up) never flash a spinner. The same view is shown before the playback plan, before the
 * player mounts and on top of the mounted player until its first frame, so the handoffs between
 * them never flash. `hidden` fades the layer out once the first real frame plays.
 */
export function PlayerStartLoading({
  hidden = false,
  ready = false,
}: {
  hidden?: boolean;
  /** The media can already play: keep the plain dark frame, never show the spinner. */
  ready?: boolean;
}) {
  const tx = useOptionalTx();
  return (
    <div
      className={cn(
        "polutek-start-loader",
        ready && "polutek-start-loader--ready",
        hidden && "polutek-start-loader--hidden",
      )}
      role={hidden ? undefined : "status"}
      aria-live="polite"
      aria-label={hidden ? undefined : tx("Ładowanie filmu…", "Loading video…")}
      aria-hidden={hidden || undefined}
      data-testid="player-start-loading"
    >
      <div className="polutek-start-loader-spinner" aria-hidden="true" />
      <style jsx global>{`
        .polutek-start-loader { position:absolute; inset:0; overflow:hidden; background:#000; opacity:1; transition:opacity 260ms cubic-bezier(0.16,1,0.3,1); }
        .polutek-start-loader--hidden { opacity:0; }
        .polutek-start-loader-spinner { position:absolute; left:50%; top:50%; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:999px; border:3px solid rgba(255,255,255,.28); border-top-color:#fff; opacity:0; animation:polutek-start-spinner-in 300ms ease 450ms forwards, polutek-start-spin .85s linear infinite; }
        .polutek-start-loader--hidden .polutek-start-loader-spinner,
        .polutek-start-loader--ready .polutek-start-loader-spinner { animation:none; opacity:0; }
        @keyframes polutek-start-spinner-in { to { opacity:1; } }
        @keyframes polutek-start-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) {
          .polutek-start-loader { transition:none; }
          .polutek-start-loader-spinner { animation:polutek-start-spinner-in 1ms linear 450ms forwards; }
        }
      `}</style>
    </div>
  );
}

/** Compact branded loading indicator for thumbnail-sized player states. */
export function PlayerLoadingIndicator() {
  return (
    <div className="polutek-player-loader" role="status" aria-live="polite">
      <div className="polutek-player-loader-mark" aria-hidden="true">
        <LoaderCircle />
      </div>
      <div className="polutek-player-loader-track" aria-hidden="true">
        <div className="polutek-player-loader-progress" />
      </div>
      <style jsx global>{`
        .polutek-player-loader { position:relative; display:flex; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; gap:8px; overflow:hidden; color:var(--chan-ink,#111827); background:radial-gradient(circle at 50% 38%,var(--cm-blue-12),transparent 44%),var(--chan-nav,#f7f9fc); font-family:var(--font-geist-sans),sans-serif; }
        .polutek-player-loader::before { content:""; position:absolute; inset:5px; border:1px solid var(--cm-line-76); border-radius:10px; box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .polutek-player-loader-mark { position:relative; display:grid; width:34px; height:34px; place-items:center; border:1px solid var(--cm-blue-22); border-radius:11px; background:var(--cm-card-90-white); color:var(--chan-blue,#2563eb); box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 16px 32px -12px var(--cm-blue-45); }
        @media (prefers-reduced-motion:no-preference) {
          .polutek-player-loader-mark, .polutek-player-loader-track { animation:polutek-loader-in 420ms cubic-bezier(0.16,1,0.3,1) both; }
          .polutek-player-loader-track { animation-delay:70ms; }
        }
        @keyframes polutek-loader-in { from { opacity:0; transform:translateY(5px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        .polutek-player-loader-mark svg { width:17px; height:17px; animation:polutek-loader-spin .9s linear infinite; }
        .polutek-player-loader-track { position:relative; width:60px; height:3px; overflow:hidden; border-radius:999px; background:var(--cm-blue-15); }
        .polutek-player-loader-progress { position:absolute; inset:0 auto 0 -38%; width:38%; border-radius:999px; background:var(--chan-blue,#2563eb); animation:polutek-loader-sweep 1.05s ease-in-out infinite; }
        @keyframes polutek-loader-sweep { 0% { transform:translateX(0); } 100% { transform:translateX(320%); } }
        @keyframes polutek-loader-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) { .polutek-player-loader-mark svg, .polutek-player-loader-progress { animation:none; } .polutek-player-loader-progress { inset:0 31%; width:38%; opacity:.8; } }
      `}</style>
    </div>
  );
}

/**
 * Unified loading state for the video player area: the dark start-up frame for the
 * full-size player, the compact branded indicator for thumbnail-sized variants.
 */
export function PlayerLoadingState({
  className,
  fill = false,
  variant = "default",
}: PlayerLoadingStateProps) {
  if (variant === "default") {
    return (
      <PlayerStateFrame className={className} fill={fill}>
        <PlayerStartLoading />
      </PlayerStateFrame>
    );
  }

  return (
    <PlayerStateFrame
      className={cn(className, "rounded-lg")}
      fill={fill || variant === "thumbnailCompact"}
    >
      <PlayerLoadingIndicator />
    </PlayerStateFrame>
  );
}
