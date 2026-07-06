import { NextRequest, NextResponse } from "next/server";
import { StorageProvider } from "@prisma/client";
import { requireAdminForApi } from "@/lib/auth-utils";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { VideoProviderReconcilerService } from "@/lib/modules/video";

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_VIDEO_PROVIDER_JOBS_RECONCILE");
  if (response) return response;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.provider === "string" && !(Object.values(StorageProvider) as string[]).includes(body.provider)) {
      return NextResponse.json({ error: "Unknown storage provider" }, { status: 400 });
    }
    const provider = typeof body.provider === "string" ? body.provider as StorageProvider : undefined;
    const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! } });
    const result = await new VideoProviderReconcilerService().reconcilePendingProviderJobs({ limit: body.limit, olderThanSeconds: body.olderThanSeconds, provider, dryRun: Boolean(body.dryRun) }, ctx);
    return NextResponse.json(result);
  } catch (error) { return handleApiError(error); }
}
