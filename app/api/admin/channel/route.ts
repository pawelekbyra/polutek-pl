import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { flags } from "@/lib/feature-flags";
import { requireAdminForApi } from "@/lib/auth-utils";
import { writeAuditLog } from "@/lib/services/audit.service";

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
});

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_CHANNEL");
  if (response) return response;

  try {
    const creator = await prisma.creator.findUnique({
      where: { slug: flags.mainCreatorSlug },
      include: {
        user: { select: { id: true, email: true, name: true, imageUrl: true } },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json({ creator });
  } catch (error) {
    console.error("[ADMIN_CHANNEL_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminForApi("PATCH_ADMIN_CHANNEL");
  if (response) return response;

  try {
    const body = await request.json();
    const result = channelPatchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.flatten() }, { status: 400 });
    }

    const creator = await prisma.creator.update({
      where: { slug: flags.mainCreatorSlug },
      data: result.data,
      include: {
        user: { select: { id: true, email: true, name: true, imageUrl: true } },
      },
    });

    await writeAuditLog({
      actorUserId: (await auth()).userId,
      action: "CHANNEL_UPDATED",
      targetType: "Creator",
      targetId: creator.id,
      metadata: { slug: flags.mainCreatorSlug, fields: Object.keys(result.data) },
    });

    return NextResponse.json({ creator });
  } catch (error) {
    console.error("[ADMIN_CHANNEL_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
