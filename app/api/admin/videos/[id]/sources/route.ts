import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { addVideoSource } from "@/lib/modules/video";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminLooseObjectSchema } from "@/lib/api/admin-schemas";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_SOURCE");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const parsed = await parseAdminBody(req, adminLooseObjectSchema);
    if (!parsed.ok) return parsed.response;

    // Provider/asset fields are validated by the addVideoSource use case.
    const result = await addVideoSource({ ...parsed.data, videoId: params.id } as Parameters<typeof addVideoSource>[0], ctx);
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
