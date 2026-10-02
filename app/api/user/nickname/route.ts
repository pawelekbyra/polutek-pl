import { NextRequest, NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { updateNickname } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getActorFromAuth({ allowGuest: false });
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as { nickname?: unknown } | null;
    if (typeof body?.nickname !== "string") {
      return NextResponse.json({ error: "INVALID_NICKNAME" }, { status: 400 });
    }
    const result = await updateNickname(createAppContext({ actor }), { userId: actor.userId, nickname: body.nickname });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
