import { NextRequest, NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { GetUserProfileUseCase } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest" || actor.type === "system") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = createAppContext({ actor });
    const user = await GetUserProfileUseCase.execute(ctx, actor.userId);

    if (!user) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json({
      language: user.language,
      isAdmin: actor.type === "admin",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
