import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAppContext } from "@/lib/modules/shared/app-context";
import {
  SyncCurrentUserUseCase,
  getOrCreateCurrentUser,
} from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ctx = createAppContext({
      actor: { type: "user", userId },
    });

    // Ensure the local user row exists. getOrCreateCurrentUser resolves the
    // Clerk profile itself and delegates to the transactional sync path, which
    // is the only one that resolves email collisions with an existing row
    // (stale-record renaming + merging comments/payments/patron grants).
    await getOrCreateCurrentUser(ctx, userId);

    const result = await SyncCurrentUserUseCase.execute(ctx);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
