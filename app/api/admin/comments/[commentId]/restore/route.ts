import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { restoreAdminComment } from "@/lib/modules/comments";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("RESTORE_COMMENT");
  if (response) return response;
  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const result = await restoreAdminComment(
      params.commentId,
      createAppContext({ actor }),
    );
    if (result.ok) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
