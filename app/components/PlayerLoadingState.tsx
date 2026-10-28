"use client";

import React from "react";
import { SpinnerArcIcon } from "./icons/MarkerUiIcons";
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
      <div className="polutek-start-loader-spinner mc-spinner" aria-hidden="true">
        <SpinnerArcIcon className="mc-spinner-arc" />
      </div>
      <style jsx global>{`
        .polutek-start-loader { position:absolute; inset:0; overflow:hidden; background:#000; opacity:1; transition:opacity 260ms cubic-bezier(0.16,1,0.3,1); }
        .polutek-start-loader--hidden { opacity:0; }
        .polutek-start-loader-spinner { position:absolute; left:50%; top:50%; margin:-24px 0 0 -24px; opacity:0; animation:polutek-start-spinner-in 300ms ease 450ms forwards; }
        .polutek-start-loader--hidden .polutek-start-loader-spinner,
        .polutek-start-loader--ready .polutek-start-loader-spinner { animation:none; opacity:0; }
        .polutek-start-loader--hidden .mc-spinner-arc,
        .polutek-start-loader--ready .mc-spinner-arc { animation:none; }
        @keyframes polutek-start-spinner-in { to { opacity:1; } }
        @media (prefers-reduced-motion:reduce) {
          .polutek-start-loader { transition:none; }
          .polutek-start-loader-spinner { animation:polutek-start-spinner-in 1ms linear 450ms forwards; }
        }
      `}</style>
    </div>
  );
}

/** Compact loading indicator for thumbnail-sized player states: the same Marker arc as the player's buffering mark, in the brand blue on the light frame. */
export function PlayerLoadingIndicator() {
  return (
    <div className="polutek-player-loader" role="status" aria-live="polite">
      <div className="polutek-player-loader-mark mc-spinner" aria-hidden="true">
        <SpinnerArcIcon className="mc-spinner-arc" />
      </div>
      <style jsx global>{`
        .polutek-player-loader { position:relative; display:flex; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; color:var(--chan-ink,#111827); background:radial-gradient(circle at 50% 38%,var(--cm-blue-12),transparent 44%),var(--chan-nav,#f7f9fc); font-family:var(--font-geist-sans),sans-serif; }
        .polutek-player-loader::before { content:""; position:absolute; inset:5px; border:1px solid var(--cm-line-76); border-radius:10px; box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .polutek-player-loader-mark.mc-spinner { width:32px; height:32px; color:var(--chan-blue,#2563eb); filter:none; }
        .polutek-player-loader-mark .mc-spinner-arc { width:32px; height:32px; }
        @media (prefers-reduced-motion:no-preference) {
          .polutek-player-loader-mark { animation:polutek-loader-in 420ms cubic-bezier(0.16,1,0.3,1) both; }
        }
        @keyframes polutek-loader-in { from { opacity:0; transform:translateY(5px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
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
