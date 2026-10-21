import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { checkAdminCsrf } from "@/lib/api/csrf";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { isVideoFavorited, setVideoFavorite } from "@/lib/modules/favorites";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Generous for real clicking, tight enough to stop scripted loops. */
const FAVORITES_PER_MINUTE = 60;

const bodySchema = z.object({ favorite: z.boolean() });

/** The signed-in viewer's own state for one video (a guest: not favorited). Used after a shallow video switch. */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id: videoId } = await props.params;
    const actor = await getActorFromAuth();
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ favorited: false }, { headers: NO_STORE });
    }
    const favorited = await isVideoFavorited(actor.userId, videoId, createAppContext({ actor }));
    return NextResponse.json({ favorited }, { headers: NO_STORE });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * PUT sets whether the viewer has the video in their favorites to `favorite`. Idempotent: the client sends the
 * state it wants, so a repeated or retried request changes nothing. A plain route, not a server action, so a page
 * left open across a deploy keeps working. Guests get 401; a video that is not on the public lists gets 404.
 */
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const scopedLogger = createScopedLogger(getCorrelationId());
  try {
    // The route sits outside /api/user, so the cross-origin guard of the proxy does not cover it.
    const csrf = checkAdminCsrf(request);
    if (csrf) return NextResponse.json(csrf.body, { status: csrf.status, headers: NO_STORE });

    const { id: videoId } = await props.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Invalid favorite." }, { status: 400, headers: NO_STORE });
    }

    const actor = await getActorFromAuth();
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sign in to save favorites." }, { status: 401, headers: NO_STORE });
    }

    const limited = await rateLimit({ key: `video-favorites:${actor.userId}`, limit: FAVORITES_PER_MINUTE, windowMs: 60_000 });
    if (!limited.success) {
      return NextResponse.json({ error: "RATE_LIMITED", message: "Too many requests." }, { status: 429, headers: NO_STORE });
    }

    const result = await setVideoFavorite({ videoId, favorite: parsed.data.favorite }, createAppContext({ actor }));
    if (!result.ok) return handleApiError(result.error);
    return NextResponse.json(result.data, { headers: NO_STORE });
  } catch (error: unknown) {
    scopedLogger.error("[VIDEO_FAVORITE_PUT_ERROR]", error);
    return handleApiError(error);
  }
}
