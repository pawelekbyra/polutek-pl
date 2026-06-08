import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from '@clerk/nextjs/server';
import { handleApiError } from '@/lib/errors';
import { createAppContext } from "@/lib/modules/shared/app-context";
import { updateUserLanguage } from "@/lib/modules/users";
import { getActorFromAuth } from "@/lib/api/auth";
import { ClerkIdentityProvider } from "@/lib/api/identity-provider";

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { language } = await req.json();
    if (language !== 'pl' && language !== 'en') {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    await updateUserLanguage(ctx, { userId, language }, new ClerkIdentityProvider());

    return NextResponse.json({ success: true });
  } catch (err) {
    scopedLogger.error('[LANGUAGE_UPDATE_ERROR]', err);
    return handleApiError(err);
  }
}

// Keep POST for backward compatibility during migration if needed,
// but it should also use the new field and logic.
export async function POST(req: NextRequest) {
    return PATCH(req);
}
