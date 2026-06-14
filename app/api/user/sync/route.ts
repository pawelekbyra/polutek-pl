import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAppContext } from "@/lib/modules/shared/app-context";
import {
  SyncCurrentUserUseCase,
  GetOrCreateUserUseCase,
} from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ctx = createAppContext({
      actor: { type: "user", userId, isPatron: false },
    });

    // Ensure user exists using modular use case
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress;

    if (email) {
      await GetOrCreateUserUseCase.execute(ctx, {
        id: userId,
        email,
        name: clerkUser.fullName,
        username: clerkUser.username,
        imageUrl: clerkUser.imageUrl,
      });
    }

    const result = await SyncCurrentUserUseCase.execute(ctx);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
