import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth, clerkClient } from '@clerk/nextjs/server';

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

    // 1. Update Database
    await prisma.user.update({
      where: { id: userId },
      data: { language: language }
    });

    // 2. Update Clerk Metadata for persistence and webhook use
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        language: language
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[LANGUAGE_UPDATE_ERROR]', err);
    return NextResponse.json({ error: "Failed to update language" }, { status: 500 });
  }
}

// Keep POST for backward compatibility during migration if needed,
// but it should also use the new field and logic.
export async function POST(req: NextRequest) {
    return PATCH(req);
}
