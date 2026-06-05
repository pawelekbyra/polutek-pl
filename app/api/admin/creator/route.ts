import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/services/audit.service';
import { auth } from '@clerk/nextjs/server';
import { flags } from '@/lib/feature-flags';
import { MainCreatorService } from '@/lib/services/main-creator.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_CREATOR");
  if (response) return response;

  try {
    const creator = flags.multiCreator
      ? await prisma.creator.findFirst({
          include: {
            user: {
              select: { id: true, email: true, name: true, imageUrl: true }
            }
          }
        })
      : await prisma.$transaction(async (tx) => {
          const mainCreator = await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, {
            repairSingleChannelContent: true,
          });

          return tx.creator.findUnique({
            where: { id: mainCreator.id },
            include: {
              user: {
                select: { id: true, email: true, name: true, imageUrl: true }
              }
            }
          });
        });

    return NextResponse.json(creator);
  } catch (error: unknown) {
    logger.error("[ADMIN_CREATOR_GET_ERROR]", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const creatorSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  bio: z.string().max(1000).optional().nullable(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  bannerUrl: z.string().url().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_CREATOR");
  if (response) return response;

  const body = await req.json();
  const result = creatorSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 });
  }

  const { id, name, bio, slug, bannerUrl } = result.data;

  try {
    if (!flags.multiCreator) {
      const updated = await prisma.$transaction(async (tx) => {
        const mainCreator = await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, {
          repairSingleChannelContent: true,
        });

        return tx.creator.update({
          where: { id: mainCreator.id },
          data: { name, bio, bannerUrl }
        });
      });

      await writeAuditLog({
          actorUserId: (await auth()).userId,
          action: "CREATOR_UPDATED",
          targetType: "Creator",
          targetId: updated.id,
          metadata: { name, slug: updated.slug, singleChannelAlias: true }
      });

      return NextResponse.json(updated);
    }

    if (id) {
      const updated = await prisma.creator.update({
        where: { id },
        data: { name, bio, slug, bannerUrl }
      });

      await writeAuditLog({
          actorUserId: (await auth()).userId,
          action: "CREATOR_UPDATED",
          targetType: "Creator",
          targetId: id,
          metadata: { name, slug }
      });

      return NextResponse.json(updated);
    } else {

        const created = await prisma.$transaction(async (tx) => {
            const firstCreator = await tx.creator.findFirst();
            const isPrimary = !firstCreator;

            const newCreator = await tx.creator.create({
                data: {
                    userId: adminUserId!,
                    name,
                    bio,
                    slug,
                    bannerUrl,
                    isApproved: true,
                    isPrimary
                }
            });

            return newCreator;
        });
        return NextResponse.json(created);
    }
  } catch (error: unknown) {
    logger.error("[ADMIN_CREATOR_POST_ERROR]", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
