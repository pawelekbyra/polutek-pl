"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { cn } from "@/lib/utils";
import { useOptionalLanguage } from "./LanguageContext";

interface PlayerLoadingStateProps {
  className?: string;
  fill?: boolean;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
  /**
   * Poster of the video being prepared. When set (full-size player only), the
   * loading state is the poster itself with a delayed spinner — a video switch
   * then reads as "the new video is already here" instead of a loader card.
   */
  posterUrl?: string | null;
}

/**
 * Poster-first loading view: the video's own thumbnail fills the frame at once,
 * and a small spinner fades in only if loading takes longer than ~0.5s, so fast
 * switches (the common case, thanks to intent preloading) never flash a spinner.
 * `hidden` fades the whole layer out (e.g. once the first real frame plays).
 */
export function PlayerPosterLoading({
  posterUrl,
  hidden = false,
  ready = false,
}: {
  posterUrl: string;
  hidden?: boolean;
  /** The media can already play: keep the plain poster, never show the spinner/scrim. */
  ready?: boolean;
}) {
  const language = useOptionalLanguage();
  return (
    <div
      className={cn(
        "polutek-poster-loader",
        ready && "polutek-poster-loader--ready",
        hidden && "polutek-poster-loader--hidden",
      )}
      role={hidden ? undefined : "status"}
      aria-live="polite"
      aria-label={hidden ? undefined : language === "pl" ? "Ładowanie filmu…" : "Loading video…"}
      aria-hidden={hidden || undefined}
      data-testid="player-poster-loading"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- same URL the preloader already warmed; next/image would request a different, uncached variant */}
      <img src={posterUrl} alt="" decoding="async" className="polutek-poster-loader-img" />
      <div className="polutek-poster-loader-spinner" aria-hidden="true" />
      <style jsx global>{`
        .polutek-poster-loader { position:absolute; inset:0; overflow:hidden; background:#000; opacity:1; transition:opacity 260ms cubic-bezier(0.16,1,0.3,1); }
        .polutek-poster-loader--hidden { opacity:0; }
        .polutek-poster-loader-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .polutek-poster-loader::after { content:""; position:absolute; inset:0; background:rgba(0,0,0,.18); opacity:0; animation:polutek-poster-scrim 300ms ease 450ms forwards; }
        .polutek-poster-loader-spinner { position:absolute; left:50%; top:50%; z-index:1; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:999px; border:3px solid rgba(255,255,255,.28); border-top-color:#fff; opacity:0; animation:polutek-poster-spinner-in 300ms ease 450ms forwards, polutek-poster-spin .85s linear infinite; }
        .polutek-poster-loader--hidden .polutek-poster-loader-spinner, .polutek-poster-loader--hidden::after,
        .polutek-poster-loader--ready .polutek-poster-loader-spinner, .polutek-poster-loader--ready::after { animation:none; opacity:0; }
        @keyframes polutek-poster-scrim { to { opacity:1; } }
        @keyframes polutek-poster-spinner-in { to { opacity:1; } }
        @keyframes polutek-poster-spin { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion:reduce) {
          .polutek-poster-loader { transition:none; }
          .polutek-poster-loader-spinner { animation:polutek-poster-spinner-in 1ms linear 450ms forwards; }
        }
      `}</style>
    </div>
  );
}

/**
 * Bar + label shown while the player prepares content. Shared between the
 * standalone access-check state below and the bare overlay VideoPlayer keeps
 * on top of the mounted media element until the first real frame renders, so
 * both loading phases read as one continuous indicator instead of two.
 */
export function PlayerLoadingIndicator({ compact = false }: { compact?: boolean }) {
  const language = useOptionalLanguage();
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
          {language === "pl" ? "Już podaję film…" : "Getting the video ready…"}
        </p>
      )}
      <style jsx global>{`
        .polutek-player-loader { position:relative; display:flex; width:100%; height:100%; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:15px; overflow:hidden; color:var(--chan-ink,#111827); background:radial-gradient(circle at 50% 38%,var(--cm-blue-12),transparent 44%),var(--chan-nav,#f7f9fc); font-family:var(--font-geist-sans),sans-serif; }
        .polutek-player-loader::before { content:""; position:absolute; inset:12px; border:1px solid var(--cm-line-76); border-radius:18px; box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .polutek-player-loader--compact { min-height:0; gap:8px; }
        .polutek-player-loader--compact::before { inset:5px; border-radius:10px; }
        .polutek-player-loader-mark { position:relative; display:grid; width:54px; height:54px; place-items:center; border:1px solid var(--cm-blue-22); border-radius:16px; background:var(--cm-card-90-white); color:var(--chan-blue,#2563eb); box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 16px 32px -12px var(--cm-blue-45); }
        @media (prefers-reduced-motion:no-preference) {
          .polutek-player-loader-mark, .polutek-player-loader-track, .polutek-player-loader-label { animation:polutek-loader-in 420ms cubic-bezier(0.16,1,0.3,1) both; }
          .polutek-player-loader-track { animation-delay:70ms; }
          .polutek-player-loader-label { animation-delay:120ms; }
        }
        @keyframes polutek-loader-in { from { opacity:0; transform:translateY(5px) scale(.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        .polutek-player-loader-mark svg { width:24px; height:24px; animation:polutek-loader-spin .9s linear infinite; }
        .polutek-player-loader--compact .polutek-player-loader-mark { width:34px; height:34px; border-radius:11px; }
        .polutek-player-loader--compact .polutek-player-loader-mark svg { width:17px; height:17px; }
        .polutek-player-loader-track { position:relative; width:min(160px,42%); height:4px; overflow:hidden; border-radius:999px; background:var(--cm-blue-15); }
        .polutek-player-loader--compact .polutek-player-loader-track { width:60px; height:3px; }
        .polutek-player-loader-progress { position:absolute; inset:0 auto 0 -38%; width:38%; border-radius:999px; background:var(--chan-blue,#2563eb); animation:polutek-loader-sweep 1.05s ease-in-out infinite; }
        .polutek-player-loader-label { position:relative; margin:0; color:var(--chan-muted,#4b5563); font-size:10.5px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
        @keyframes polutek-loader-sweep { 0% { transform:translateX(0); } 100% { transform:translateX(320%); } }
        @keyframes polutek-loader-spin { to { transform:rotate(360deg); } }
        @media (max-width:640px) { .polutek-player-loader { min-height:0; gap:11px; } .polutek-player-loader-mark { width:46px; height:46px; } .polutek-player-loader-label { font-size:10px; } }
        @media (prefers-reduced-motion:reduce) { .polutek-player-loader-mark svg, .polutek-player-loader-progress { animation:none; } .polutek-player-loader-progress { inset:0 31%; width:38%; opacity:.8; } }
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
  posterUrl,
}: PlayerLoadingStateProps) {
  const isThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";

  if (posterUrl && !isThumbnail) {
    return (
      <PlayerStateFrame className={className} fill={fill}>
        <PlayerPosterLoading posterUrl={posterUrl} />
      </PlayerStateFrame>
    );
  }

  return (
    <PlayerStateFrame
      className={cn(className, isThumbnail ? "rounded-lg" : undefined)}
      fill={fill || variant === "thumbnailCompact"}
    >
      <PlayerLoadingIndicator compact={isThumbnail} />
    </PlayerStateFrame>
  );
}
