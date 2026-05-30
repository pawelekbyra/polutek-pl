import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/auth-utils';
import { ADMIN_EMAIL } from '@/lib/constants';
import { z } from 'zod';

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

const creatorSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(100),
  bio: z.string().max(1000).optional().nullable(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  bannerUrl: z.string().url().optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const result = creatorSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 });
  }

  const { id, name, bio, slug, bannerUrl } = result.data;

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
