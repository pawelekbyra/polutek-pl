import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import {
  getAdminChannelSettings,
  updateAdminChannelSettings,
  AdminChannelSettingsDTO,
} from "@/lib/modules/channel";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { logAdminChannelError } from "@/lib/admin-channel-error-classification";

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
  bio: z
    .string()
    .trim()
    .max(1_000)
    .optional()
    .nullable()
    .transform((value) => value || null),
  bannerUrl: optionalUrl,
  displaySubscribersCount: z.number().int().min(0).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const { adminUserId, response } =
    await requireAdminForApi("GET_ADMIN_CHANNEL");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const creator = await getAdminChannelSettings(ctx);

    return NextResponse.json({ creator });
  } catch (error) {
    logAdminChannelError(error, "ADMIN_CHANNEL_GET_ERROR", requestId);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = request.headers.get("x-request-id");
  const { adminUserId, response } = await requireAdminForApi(
    "PATCH_ADMIN_CHANNEL",
  );
  if (response) return response;

  try {
    const body = await request.json();
    const result = channelPatchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid data", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const creator = await updateAdminChannelSettings(ctx, result.data);

    return NextResponse.json({ creator });
  } catch (error) {
    logAdminChannelError(error, "ADMIN_CHANNEL_PATCH_ERROR", requestId);
    return handleApiError(error);
  }
}
