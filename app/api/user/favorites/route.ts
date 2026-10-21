import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listFavoriteVideos } from "@/lib/modules/favorites";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** The signed-in viewer's own favorites (still-listed videos, newest saved first). Guests: 401. */
export async function GET() {
  try {
    const actor = await getActorFromAuth();
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE });
    }
    const items = await listFavoriteVideos(actor.userId, createAppContext({ actor }));
    return NextResponse.json({ items }, { headers: NO_STORE });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
