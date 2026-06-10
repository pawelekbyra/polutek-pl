import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto } from "../domain/video.dto";
import { getAdminVideoById } from "./get-admin-video-by-id.use-case";
import { getAdminVideoDiagnostics, DiagnosticIssue } from "./get-admin-video-diagnostics.use-case";
import { getAuditLogs } from "@/lib/modules/audit";

export type GetAdminVideoDetailsInput = {
  idOrSlug: string;
};

export type AdminVideoDetailsDto = AdminVideoDto & {
  diagnostics: DiagnosticIssue[];
  auditLogs: any[];
};

export async function getAdminVideoDetails(
  input: GetAdminVideoDetailsInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDetailsDto>> {
  // 1. Core video lookup
  const videoResult = await getAdminVideoById(input, ctx);
  if (!videoResult.ok) return fail(videoResult.error);

  const video = videoResult.data;
  const videoId = video.id;

  // 2. Fetch diagnostics
  const diagnosticsResult = await getAdminVideoDiagnostics({ videoId }, ctx);
  const diagnostics = diagnosticsResult.ok ? diagnosticsResult.data : [];

  // 3. Fetch audit logs
  const auditLogsResult = await getAuditLogs({
    targetType: 'Video',
    targetId: videoId,
    limit: 50
  }, ctx);
  const auditLogs = auditLogsResult.ok ? auditLogsResult.data : [];

  return ok({
    ...video,
    diagnostics,
    auditLogs
  });
}
