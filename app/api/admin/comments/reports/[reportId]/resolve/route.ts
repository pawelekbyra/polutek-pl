import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { resolveCommentReport } from "@/lib/modules/comments";
import { CommentReportStatus } from "@prisma/client";
import { handleApiError, fromUseCaseResult } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, props: { params: Promise<{ reportId: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi(
    "RESOLVE_COMMENT_REPORT",
  );
  if (response) return response;
  try {
    const { status } = await req.json();
    if (!["DISMISSED", "ACTION_TAKEN"].includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const actor = { type: "admin" as const, userId: adminUserId! };
    const result = await resolveCommentReport(
      params.reportId,
      status as CommentReportStatus,
      createAppContext({ actor }),
    );
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
