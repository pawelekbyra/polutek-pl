import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { reportComment } from "@/lib/modules/comments";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "HATE", "NSFW", "SPOILER", "OTHER"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  try {
    const actor = await getActorFromAuth();

    if (actor.type === "guest" || !("userId" in actor)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const rateLimitResult = await rateLimit({
      key: `reports:${actor.userId}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, message: "Zbyt wiele zgłoszeń. Spróbuj później." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const resultJson = reportSchema.safeParse(body);
    if (!resultJson.success) {
      return NextResponse.json(
        { success: false, message: "Nieprawidłowe dane." },
        { status: 400 },
      );
    }

    const ctx = createAppContext({ actor });
    const result = await reportComment(
      {
        commentId: params.commentId,
        reason: resultJson.data.reason,
        note: resultJson.data.note,
      },
      ctx,
    );

    if (!result.ok) {
      const status =
        result.error.type === "UNAUTHORIZED"
          ? 401
          : result.error.type === "FORBIDDEN"
            ? 403
            : 400;
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dziękujemy, zgłoszenie zostało zapisane.",
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
