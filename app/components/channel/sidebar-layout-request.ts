import type { PublicVideoDTO } from "@/app/types/video";
import { logger } from "@/lib/logger";

export type SidebarLayoutItem = PublicVideoDTO & {
  isLocked?: boolean;
  creatorId?: string | null;
};

export type SidebarLayoutSection = {
  id: string;
  type: "FREE" | "LOGGED_IN" | "PATRON" | "ANNOUNCEMENT";
  title: string;
  items: SidebarLayoutItem[];
};

export type SidebarLayout = {
  viewerState: "ANONYMOUS" | "LOGGED_IN" | "PATRON" | "ADMIN";
  sections: SidebarLayoutSection[];
  currentVideoId?: string;
};

export type SidebarLayoutResult =
  | { status: "ok"; layout: SidebarLayout }
  | { status: "error" }
  | { status: "aborted" };

export type SidebarLayoutRequest = {
  promise: Promise<SidebarLayoutResult>;
  controller: AbortController;
  subscribers: number;
  settled: boolean;
};

/**
 * ChannelHome renders TWO SidebarPlaylist instances at once — the always-mounted
 * mobile "videos" tab panel and the desktop aside (both stay mounted by design,
 * only CSS-hidden per viewport; see the "always-mounted" note in CLAUDE.md). Each
 * instance used to fire its own `/api/channel/sidebar` request on mount, so every
 * page view did that route's DB work twice on the highest-traffic page in the app.
 *
 * This map holds only IN-FLIGHT requests, keyed by viewer identity — it is never a
 * result cache. The entry is dropped as soon as the request settles, so a later
 * mount, or any auth-state change (which changes the key), always refetches and can
 * never be served a stale layout.
 */
const inFlightSidebarLayouts = new Map<string, SidebarLayoutRequest>();

export function sidebarLayoutViewerKey(
  userId: string | null | undefined,
  isSignedIn: boolean | undefined,
): string {
  return `${userId ?? "anonymous"}:${isSignedIn ? "in" : "out"}`;
}

async function fetchSidebarLayout(
  controller: AbortController,
): Promise<SidebarLayoutResult> {
  try {
    const res = await fetch("/api/channel/sidebar", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`Sidebar layout fetch failed with status: ${res.status}`);
      return { status: "error" };
    }
    const data: SidebarLayout = await res.json();
    if (controller.signal.aborted) return { status: "aborted" };
    return { status: "ok", layout: data };
  } catch (err) {
    if (controller.signal.aborted) return { status: "aborted" };
    logger.error("Failed to fetch sidebar layout", err);
    return { status: "error" };
  }
}

/**
 * Returns the in-flight request for this viewer, starting one only if there isn't
 * already an unsettled request. Every caller must pair this with
 * {@link releaseSidebarLayout} in its effect cleanup.
 */
export function acquireSidebarLayout(viewerKey: string): SidebarLayoutRequest {
  const existing = inFlightSidebarLayouts.get(viewerKey);
  if (existing) {
    existing.subscribers += 1;
    return existing;
  }

  const controller = new AbortController();
  const request: SidebarLayoutRequest = {
    controller,
    subscribers: 1,
    settled: false,
    promise: fetchSidebarLayout(controller),
  };
  inFlightSidebarLayouts.set(viewerKey, request);

  void request.promise.then(() => {
    request.settled = true;
    if (inFlightSidebarLayouts.get(viewerKey) === request) {
      inFlightSidebarLayouts.delete(viewerKey);
    }
  });

  return request;
}

export function releaseSidebarLayout(
  viewerKey: string,
  request: SidebarLayoutRequest,
) {
  request.subscribers -= 1;
  if (request.subscribers > 0 || request.settled) return;
  // Last subscriber detached before the response landed — equivalent to the
  // previous per-instance `controller.abort()` cleanup.
  request.controller.abort();
  if (inFlightSidebarLayouts.get(viewerKey) === request) {
    inFlightSidebarLayouts.delete(viewerKey);
  }
}
