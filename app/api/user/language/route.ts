import { logger } from "@/lib/logger";
import { NextResponse, NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { language } = await req.json();
    if (language !== 'pl' && language !== 'en') {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }

    // Centralized update for both DB and Clerk Metadata
    await UserService.updateUserLanguage(userId, language);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[LANGUAGE_UPDATE_ERROR]', err);
    return NextResponse.json({ error: "Failed to update language" }, { status: 500 });
  }
}

// Keep POST for backward compatibility during migration if needed,
// but it should also use the new field and logic.
export async function POST(req: NextRequest) {
    return PATCH(req);
}
