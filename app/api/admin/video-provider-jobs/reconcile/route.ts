import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoProviderReconcilerService } from "@/lib/modules/video";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminProviderJobsReconcileSchema } from "@/lib/api/admin-schemas";

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_PROVIDER_JOBS_RECONCILE");
  if (response) return response;
  try {
    const parsed = await parseAdminBody(req, adminProviderJobsReconcileSchema, { allowEmpty: true });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const provider = body.provider;
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const result = await new VideoProviderReconcilerService().reconcilePendingProviderJobs({ limit: body.limit, olderThanSeconds: body.olderThanSeconds, provider, dryRun: Boolean(body.dryRun) }, ctx);
    return NextResponse.json(result);
  } catch (error) { return handleApiError(error); }
}
