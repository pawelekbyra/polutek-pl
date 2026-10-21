"use client";

import React, { useEffect, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { useAuth } from "@/lib/auth/react";
import { useAuthModal } from "./auth/AuthModalProvider";
import { useLanguage } from "./LanguageContext";
import { useToast } from "@/app/hooks/useToast";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import styles from "./watch-actions.module.css";

/** Fired on `window` after a favorite was saved or removed, so the "Ulubione" shelf reloads its list. */
export const FAVORITES_CHANGED_EVENT = "polutek:favorites-changed";

type Outcome = "ok" | "unauthorized" | "failed";

/** Sets the viewer's favorite state of a video on the server; retries once on a network error or a 5xx. */
async function sendFavorite(videoId: string, favorite: boolean): Promise<Outcome> {
  let last: Outcome = "failed";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 400));
    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/favorite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite }),
        cache: "no-store",
      });
      if (response.status === 401) return "unauthorized";
      if (response.ok) return "ok";
      last = "failed";
      if (response.status < 500) return last;
    } catch {
      last = "failed";
    }
  }
  return last;
}

/**
 * "Add to favorites": a small icon-only button under the video that saves THE VIDEO to the viewer's private
 * favorites. Optimistic and idempotent like the like button: each request carries the wanted state (not a
 * toggle), requests run one after another, only the newest result is shown, a failure restores the last
 * confirmed state with a toast, a signed-out click opens the sign-in window.
 * `initialFavorited` comes from the server render; without it (after a shallow video switch) the button asks the API.
 */
export default function FavoriteButton({
  videoId,
  initialFavorited,
  className,
}: {
  videoId: string;
  initialFavorited?: boolean;
  className?: string;
}) {
  const { tx } = useLanguage();
  const toast = useToast();
  const { userId } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [favorited, setFavorited] = useState(Boolean(userId && initialFavorited));
  const actedRef = useRef(false);
  const videoRef = useRef(videoId);
  const sync = useRef<{ running: boolean; desired: boolean | undefined; confirmed: boolean }>({
    running: false,
    desired: undefined,
    confirmed: false,
  });

  useEffect(() => {
    videoRef.current = videoId;
    actedRef.current = false;
    setFavorited(Boolean(userId && initialFavorited));
    if (!userId || initialFavorited !== undefined) return;
    const controller = new AbortController();
    fetch(`/api/videos/${encodeURIComponent(videoId)}/favorite`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { favorited?: boolean } | null) => {
        if (data && !actedRef.current) setFavorited(Boolean(data.favorited));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [videoId, userId, initialFavorited]);

  const flush = async (id: string) => {
    const state = sync.current;
    state.running = true;
    try {
      while (state.desired !== undefined) {
        const target = state.desired;
        state.desired = undefined;
        const outcome = await sendFavorite(id, target);
        const showable = videoRef.current === id;
        if (outcome === "ok") {
          state.confirmed = target;
          window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT));
        } else if (outcome === "unauthorized") {
          state.desired = undefined;
          if (showable) setFavorited(state.confirmed);
          openAuthModal("sign-in");
        } else if (state.desired === undefined) {
          logger.error("[FavoriteButton] Saving the favorite failed");
          if (showable) setFavorited(state.confirmed);
          toast(tx("Nie udało się zapisać ulubionych. Spróbuj ponownie.", "Could not update your favorites. Try again."), "error");
        }
      }
    } finally {
      state.running = false;
    }
  };

  const handleClick = () => {
    if (!userId) return openAuthModal("sign-in");
    actedRef.current = true;
    const next = !favorited;
    setFavorited(next);
    const state = sync.current;
    if (!state.running) state.confirmed = favorited;
    state.desired = next;
    if (!state.running) void flush(videoId);
  };

  const label = favorited ? tx("Usuń z ulubionych", "Remove from favorites") : tx("Dodaj do ulubionych", "Add to favorites");
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] active:scale-95", styles.favoriteAction, className)}
    >
      <Rocket aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </button>
  );
}
