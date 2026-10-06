import { cache } from "react";
import { headers } from "next/headers";
import { preconnect, preload } from "react-dom";
import { getActorFromAuth } from "@/lib/api/auth";
import { getClientIp } from "@/lib/api/client-ip";
import { createAppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { listVideoComments } from "@/lib/modules/comments";
import { PlaybackService, isPlayableServerPlan, toPublicPlaybackPlan } from "@/lib/modules/playback";
import { clientFingerprint } from "@/lib/modules/privacy";
import { isUpcomingPremiere } from "@/lib/premiere";
import { buildMediaRateLimitKey } from "@/lib/media/rate-limit";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { PublicVideoDTO } from "@/app/types/video";
import type { InitialCommentsPage } from "@/app/components/comments/initial-comments";
import type { InitialPlaybackPlan } from "@/app/components/preload/initial-playback-plan";

/**
 * Per-viewer data the home page renders on the server, so the first HTML is complete: the first
 * page of comments and the hero's playback plan. Everything here is for the viewer of THIS
 * request; the page is `force-dynamic` and answered `private, no-store`, and nothing here is put
 * in a shared cache (CLAUDE.md 4.3). Every loader fails soft: on any problem it returns null and
 * the browser loads that piece itself, exactly as before.
 */

/** The DB-backed actor of this request, resolved once per render; null when it cannot be resolved. */
export const getHomeViewerActor = cache(async (): Promise<Actor | null> => {
  try {
    return await getActorFromAuth();
  } catch (error) {
    logger.warn("[HOME_VIEWER_ACTOR_ERROR]", error instanceof Error ? error.message : String(error));
    return null;
  }
});

/** First page of comments, the same JSON `GET /api/comments?videoId=…&sortBy=newest` returns. */
export async function loadInitialComments(videoId: string, actor: Actor | null): Promise<InitialCommentsPage | null> {
  if (!actor) return null;
  try {
    const result = await listVideoComments(
      { videoId, sortBy: "newest", limit: 20 },
      createAppContext({ actor }),
    );
    if (!result.ok) return null;
    // Exactly the API's JSON (dates as strings), so the client cache holds one shape.
    const page = JSON.parse(JSON.stringify({ success: true, ...result.data }));
    return { videoId, sortBy: "newest", page };
  } catch (error) {
    logger.error("[HOME_INITIAL_COMMENTS_ERROR]", error);
    return null;
  }
}

// Crawlers get the page without a plan: they never play, so no playback session is opened for them.
const CRAWLER_UA_RE = /(bot\b|bot\/|crawler|spider|slurp|facebookexternalhit|bingpreview|embedly|ia_archiver)/i;

/**
 * Whether the browser would ask for a plan at all. A guest on a sign-in-only video and anyone on
 * an upcoming premiere get a lock or the countdown from the video's own data, with no request
 * (PremiumWrapper), so the server does not make one either.
 */
export function shouldRenderHeroPlan(video: Pick<PublicVideoDTO, "tier" | "premiereAt" | "status">, actor: Actor, now = new Date()): boolean {
  if (isUpcomingPremiere(video, now)) return false;
  if (actor.type === "guest" && video.tier !== "PUBLIC") return false;
  return true;
}

/**
 * The hero's playback plan, made in this request instead of by the browser after hydration
 * (`/api/media-source`), so the player starts without that round trip. Same service, same gates
 * (access, premiere), same sanitizer and the same per-viewer rate limit as the API; a denied or
 * failed plan carries no URL, token or session. When the plan can play, the browser is told to
 * connect to the video host and fetch the manifest while it is still parsing the page.
 */
export async function loadHeroPlaybackPlan(args: {
  video: PublicVideoDTO;
  actor: Actor | null;
  viewerKey: string | null;
}): Promise<InitialPlaybackPlan | null> {
  const { video, actor, viewerKey } = args;
  if (!actor || !viewerKey || !shouldRenderHeroPlan(video, actor)) return null;

  try {
    const requestHeaders = await headers();
    const ua = requestHeaders.get("user-agent") || "unknown";
    if (CRAWLER_UA_RE.test(ua)) return null;

    const ip = getClientIp(requestHeaders) || "unknown";
    const userId = actor.type === "user" || actor.type === "admin" ? actor.userId : null;
    const limit = await rateLimit({
      key: `media-source:${buildMediaRateLimitKey({ userId, ip, mediaId: video.id })}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return null;

    // Keyed hashes (HMAC), the same as /api/media-source stores and /api/videos/[id]/playback-event checks:
    // a plain SHA-256 here made the first browser event fail with SESSION_OWNERSHIP_MISMATCH (403) and
    // stored a reversible IP hash.
    const { ipHash, uaHash } = clientFingerprint(ip, ua);
    const plan = await PlaybackService.createPlaybackPlanWithContext(video.id, createAppContext({ actor }), ipHash, uaHash);
    const publicPlan = toPublicPlaybackPlan(plan, {
      onRawUrlBlocked: () => logger.error("[HOME_HERO_PLAN_RAW_URL_BLOCKED]", { videoId: video.id }),
    });

    if (isPlayableServerPlan(publicPlan) && publicPlan.source?.playbackUrl) {
      hintManifest(publicPlan.source.playbackUrl);
    }
    return { videoId: video.id, viewerKey, plan: publicPlan };
  } catch (error) {
    logger.error("[HOME_HERO_PLAN_ERROR]", error);
    return null;
  }
}

/** `<link rel=preconnect>` to the video host and `<link rel=preload as=fetch>` for the manifest. */
function hintManifest(masterUrl: string) {
  try {
    const origin = new URL(masterUrl).origin;
    // hls.js loads playlists with XHR without credentials: an anonymous CORS preload matches it.
    preconnect(origin, { crossOrigin: "anonymous" });
    preload(masterUrl, { as: "fetch", crossOrigin: "anonymous" });
  } catch {
    // A hint only; never let it break the page.
  }
}
