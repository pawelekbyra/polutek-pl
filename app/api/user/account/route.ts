import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { AccountDeletionCleanupUseCase } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const actor = await getActorFromAuth({ allowGuest: false });
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = createAppContext({
      actor: { type: "system", reason: "App-initiated account deletion cleanup" },
    });

    const cleanup = await AccountDeletionCleanupUseCase.execute(ctx, {
      userId: actor.userId,
      source: "APP_ACCOUNT_DELETION",
      reason: "App-initiated account deletion",
    });

    try {
      const client = await clerkClient();
      await client.users.deleteUser(actor.userId);
    } catch (error) {
      logger.error("[AccountDeletionRoute] Clerk user deletion failed after local cleanup", {
        userId: actor.userId,
        error,
      });
      return NextResponse.json(
        {
          error: "CLERK_DELETION_FAILED",
          message: "Local account data was cleaned up, but identity-provider deletion must be retried.",
          cleanup,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, cleanup });
  } catch (error) {
    return handleApiError(error);
  }
}
