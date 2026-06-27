import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { makeSourcePrimary, removeVideoSource } from "@/lib/modules/video";
import { fromUseCaseResult, handleApiError } from "@/lib/api/api-response";
import { createAppContext } from "@/lib/modules/shared/app-context";

type Params = { params: Promise<{ id: string; sourceId: string }> };

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("PATCH_ADMIN_VIDEO_SOURCE");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const body = await req.json();

    if (body.action === "make-primary") {
      const result = await makeSourcePrimary(params.id, params.sourceId, ctx);
      return fromUseCaseResult(result);
    }

    return handleApiError(new Error("Unknown action"));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, props: Params) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("DELETE_ADMIN_VIDEO_SOURCE");
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });

    const result = await removeVideoSource(params.id, params.sourceId, ctx);
    return fromUseCaseResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}
