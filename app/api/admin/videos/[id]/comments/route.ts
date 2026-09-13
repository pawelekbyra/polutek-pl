import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listVideoComments, commentErrorStatus } from "@/lib/modules/comments";
import { requireAdminForApi } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi(
    "GET_ADMIN_VIDEO_COMMENTS",
  );
  if (response) return response;
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = (searchParams.get("sortBy") as any) || "newest";
    const cursor = searchParams.get("cursor") || undefined;
    const limit = 50;

    const ctx = createAppContext({
      actor: { type: "admin", userId: adminUserId! },
    });
    const result = await listVideoComments(
      {
        videoId: params.id,
        sortBy,
        cursor,
        limit,
      },
      ctx,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: commentErrorStatus(result.error) },
      );
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
