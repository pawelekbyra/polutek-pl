import { NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listSubscribedChannels } from "@/lib/modules/subscriptions";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Channels the signed-in user follows, for the side menu. Session is required (middleware and here). */
export async function GET() {
  try {
    const actor = await getActorFromAuth();
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "private, no-store" } });
    }
    const ctx = createAppContext({ actor });
    const items = await listSubscribedChannels(ctx, actor.userId);
    return NextResponse.json({ items }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
