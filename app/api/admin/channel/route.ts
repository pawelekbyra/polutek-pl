import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import {
  getAdminChannelSettings,
  updateAdminChannelSettings,
} from "@/lib/modules/channel";
import { createAppContext } from "@/lib/modules/shared/app-context";

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
  defaultThumbnailUrl: optionalUrl,
  displaySubscribersCount: z.number().int().min(0).nullable().optional(),
});

function getSafeChannelDiagnosticsError(error: unknown) {
  const candidate = error as { name?: unknown; code?: unknown; statusCode?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "UNKNOWN";
  const name = typeof candidate.name === "string" ? candidate.name : "Error";

  if (
    code === "CHANNEL_NOT_FOUND" ||
    code === "CHANNEL_NOT_APPROVED" ||
    code === "CHANNEL_NOT_PRIMARY"
  ) {
    return {
      status: typeof candidate.statusCode === "number" ? candidate.statusCode : 400,
      code,
      name,
    };
  }

  return {
    status: 500,
    code: "CHANNEL_DIAGNOSTICS_ERROR",
    name,
  };
}

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } =
    await requireAdminForApi("GET_ADMIN_CHANNEL");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const { creator, diagnostics } = await getAdminChannelSettings(ctx);

    return NextResponse.json({ creator, diagnostics });
  } catch (error) {
    const safeError = getSafeChannelDiagnosticsError(error);
    scopedLogger.error("[ADMIN_CHANNEL_GET_ERROR]", {
      code: safeError.code,
      name: safeError.name,
      adminUserId,
    });
    return NextResponse.json(
      {
        error: "CHANNEL_DIAGNOSTICS_ERROR",
        message:
          "Channel diagnostics could not be loaded. Review server logs before changing channel data.",
        diagnostics: {
          ok: false,
          code: safeError.code,
        },
      },
      { status: safeError.status },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = request.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);
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
    scopedLogger.error("[ADMIN_CHANNEL_PATCH_ERROR]", error);
    return handleApiError(error);
  }
}
