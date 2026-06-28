import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { provisionMuxUpload } from "@/lib/modules/video/application/provision-mux-upload.use-case";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_MUX_UPLOAD");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const body = await req.json().catch(() => ({}));

    const result = await provisionMuxUpload(
      { videoId: params.id, primaryIntent: Boolean(body.primaryIntent) },
      ctx
    );
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
