import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/auth-utils";
import { writeAuditLog } from "@/lib/services/audit.service";
import { MainCreatorService } from "@/lib/services/main-creator.service";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const optionalUrl = z
  .string()
  .trim()
  .max(2_000)
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null;
    return value;
  })
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Podaj poprawny adres URL http(s) albo zostaw pole puste.");

const channelPatchSchema = z.object({
  name: z.string().trim().min(1, "Nazwa kanału jest wymagana.").max(100),
  bio: z.string().trim().max(1_000).optional().nullable().transform((value) => value || null),
  bannerUrl: optionalUrl,
  fakeSubscribersCount: z.number().int().min(0).optional().nullable(),
  currencySettings: z.array(z.object({
    code: z.string(),
    minAmountMinor: z.number().int().min(0)
  })).optional(),
});

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_CHANNEL");
  if (response) return response;

  try {
    const data = await prisma.$transaction(async (tx) => {
      const mainCreator = await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, {
        repairSingleChannelContent: true,
      });

      const creator = await tx.creator.findUnique({
        where: { id: mainCreator.id },
        select: {
            id: true,
            slug: true,
            name: true,
            bio: true,
            bannerUrl: true,
            subscribersCount: true,
            fakeSubscribersCount: true,
            user: { select: { id: true, email: true, name: true, imageUrl: true } },
        }
      });

      const currencySettings = await tx.currencySetting.findMany();
      return { creator, currencySettings };
    });

    return NextResponse.json(data);
  } catch (error) {
    scopedLogger.error("[ADMIN_CHANNEL_GET_ERROR]", error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = request.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_CHANNEL");
  if (response) return response;

  try {
    const body = await request.json();
    const result = channelPatchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.flatten() }, { status: 400 });
    }

    const creator = await prisma.$transaction(async (tx) => {
      const mainCreator = await MainCreatorService.getOrCreateForAdmin(adminUserId!, tx, {
        repairSingleChannelContent: true,
      });

      const { currencySettings, ...channelData } = result.data;

      if (currencySettings) {
        for (const setting of currencySettings) {
            await tx.currencySetting.upsert({
                where: { code: setting.code },
                create: setting,
                update: { minAmountMinor: setting.minAmountMinor }
            });
        }
      }

      return tx.creator.update({
        where: { id: mainCreator.id },
        data: channelData,
        select: {
            id: true,
            slug: true,
            name: true,
            bio: true,
            bannerUrl: true,
            subscribersCount: true,
            fakeSubscribersCount: true,
            user: { select: { id: true, email: true, name: true, imageUrl: true } },
        }
      });
    });

    await writeAuditLog({
      actorUserId: (await auth()).userId,
      action: "CHANNEL_UPDATED",
      targetType: "Creator",
      targetId: creator.id,
      metadata: { slug: creator.slug, fields: Object.keys(result.data) },
    });

    return NextResponse.json({ creator });
  } catch (error) {
    scopedLogger.error("[ADMIN_CHANNEL_PATCH_ERROR]", error);
    return handleApiError(error);
  }
}
