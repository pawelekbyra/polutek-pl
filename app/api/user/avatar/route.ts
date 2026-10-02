import { NextRequest, NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { updateAvatar } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

async function resolveUser() {
  const actor = await getActorFromAuth({ allowGuest: false });
  if (actor.type !== "user" && actor.type !== "admin") return null;
  return actor;
}

/** Sets the avatar from a browser-resized data URL (validated server-side). */
export async function PUT(req: NextRequest) {
  try {
    const actor = await resolveUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => null)) as { dataUrl?: unknown } | null;
    if (typeof body?.dataUrl !== "string") {
      return NextResponse.json({ error: "INVALID_AVATAR" }, { status: 400 });
    }
    const result = await updateAvatar(createAppContext({ actor }), { userId: actor.userId, dataUrl: body.dataUrl });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Restores the default avatar. */
export async function DELETE() {
  try {
    const actor = await resolveUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await updateAvatar(createAppContext({ actor }), { userId: actor.userId, dataUrl: null });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
