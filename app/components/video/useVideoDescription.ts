"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicVideoDTO } from "@/app/types/video";

type Description = { description: string | null; descriptionEn: string | null };

// Public, viewer-independent text, kept for the life of the tab only (a module Map, never storage), so going back to
// a video already opened needs no second request.
const loaded = new Map<string, Description>();
const inFlight = new Map<string, Promise<Description | null>>();

function loadDescription(videoId: string): Promise<Description | null> {
  const pending = inFlight.get(videoId);
  if (pending) return pending;
  const request = fetch(`/api/videos/${encodeURIComponent(videoId)}/description`, { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as Partial<Description>;
      const value: Description = { description: data.description ?? null, descriptionEn: data.descriptionEn ?? null };
      loaded.set(videoId, value);
      return value;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(videoId));
  inFlight.set(videoId, request);
  return request;
}

/** Test hook: forget what was loaded. */
export function __resetVideoDescriptionsForTests() {
  loaded.clear();
  inFlight.clear();
}

/**
 * The home list carries no descriptions (W03): a video from it has `description === undefined` ("not loaded"). This
 * returns the same video with its description once it is known, fetching it only for the video that is open. A video
 * that already carries one (the server-selected video, a featured or extra video) is returned as it is.
 */
export function useVideoDescription<T extends PublicVideoDTO | null>(video: T): T {
  const id = video?.id;
  const needs = Boolean(video) && video!.description === undefined;
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!id || !needs || loaded.has(id)) return;
    let cancelled = false;
    void loadDescription(id).then((value) => {
      if (value && !cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [id, needs]);

  const hit = id && needs ? loaded.get(id) : undefined;
  return useMemo(() => (video && hit ? { ...video, ...hit } : video), [video, hit]);
}
