import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/auth-utils';
import { ADMIN_EMAIL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const creator = await prisma.creator.findFirst({
        include: { user: true }
    });
    return NextResponse.json(creator);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, name, bio, slug, bannerUrl } = body;

  try {
    if (id) {
      const updated = await prisma.creator.update({
        where: { id },
        data: { name, bio, slug, bannerUrl }
      });
      return NextResponse.json(updated);
    } else {
        const adminUser = await prisma.user.findFirst({
            where: { email: ADMIN_EMAIL }
        });

        if (!adminUser) {
            return NextResponse.json({ error: 'Admin user not found in DB.' }, { status: 400 });
        }

        const created = await prisma.creator.create({
            data: {
                userId: adminUser.id,
                name,
                bio,
                slug,
                bannerUrl
            }
        });
        return NextResponse.json(created);
    }
  } catch (error: unknown) {
    console.error("[ADMIN_CREATOR_POST_ERROR]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
