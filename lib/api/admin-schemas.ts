/**
 * Zod schemas for the JSON bodies of mutating /api/admin routes.
 *
 * Rules kept on purpose:
 *  - Unknown extra fields are stripped (zod default), never rejected, so the
 *    current admin UI payloads keep working.
 *  - Routes that hand a large, use-case-validated payload straight through
 *    (video metadata, sources) only assert "a JSON object" here via
 *    `adminLooseObjectSchema`; their domain validation lives in the use case.
 */
import { z } from "zod";
import { CommentDeletedReason, StorageProvider } from "@prisma/client";

/** Any JSON object (arrays, null and scalars are rejected). Keys are kept. */
export const adminLooseObjectSchema = z.record(z.string(), z.unknown());

export const adminCommentReportResolveSchema = z.object({
  status: z.enum(["DISMISSED", "ACTION_TAKEN"]),
});

export const adminCommentDeleteSchema = z.object({
  reason: z.nativeEnum(CommentDeletedReason).nullish(),
});

export const adminInboundEmailPatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "READ", "ARCHIVED", "RESOLVED"]),
});

export const adminNotificationBroadcastSchema = z.object({
  titlePl: z.string().min(1),
  titleEn: z.string().min(1),
  bodyPl: z.string().min(1),
  bodyEn: z.string().min(1),
  audience: z.enum(["ALL", "PATRONS"]),
  href: z.string().nullish().transform((v) => v ?? undefined),
});

export const adminNotificationTemplateSchema = z.object({
  // Membership in NOTIFICATION_TEMPLATE_KINDS is checked in the route.
  kind: z.string().min(1),
  titlePl: z.string().min(1),
  titleEn: z.string().min(1),
  bodyPl: z.string().min(1),
  bodyEn: z.string().min(1),
});

/** Empty body = full refund. */
export const adminPaymentRefundSchema = z.object({
  amountMinor: z.number().int().positive().max(100_000_000).optional(),
  reason: z.string().max(1000).optional(),
});

export const adminPatronActionSchema = z.object({
  action: z.enum(["grant", "revoke"]),
  reason: z.string().max(2000).nullish(),
  note: z.string().max(2000).nullish(),
});

export const adminProbeSchema = z.object({
  probe: z.literal("direct-upload"),
});

export const adminProviderJobsReconcileSchema = z.object({
  provider: z.nativeEnum(StorageProvider).optional(),
  limit: z.number().int().positive().max(500).optional(),
  olderThanSeconds: z.number().int().nonnegative().max(31_536_000).optional(),
  dryRun: z.boolean().optional(),
});

export const adminDistributionBackfillSchema = z.object({
  limit: z.number().positive().max(10_000).optional(),
  dryRun: z.boolean().optional(),
  videoId: z.string().min(1).optional(),
});

export const adminVideoReorderSchema = z.object({
  videos: z
    .array(
      z.object({
        id: z.string().min(1),
        sidebarOrder: z.number().int(),
        showInSidebar: z.boolean(),
      }),
    )
    .max(1000),
});

export const adminVideoResyncSchema = z.object({
  videoId: z.string().min(1),
});

export const adminVideoActionSchema = z
  .object({
    action: z.enum([
      "publish",
      "unpublish",
      "archive",
      "restore",
      "set-hero",
      "create-upload-url",
      "attach-asset",
      "import-legacy-to-cloudflare",
      "sync-cloudflare",
    ]),
    providerAssetId: z.string().optional(),
    providerPlaybackId: z.string().optional(),
    publishAfterAssetReady: z.boolean().optional(),
  });

export const adminDistributionPlanSchema = z.object({
  originalId: z.string().nullish(),
  strategy: z.unknown().optional(),
  publishAfterReady: z.boolean().optional(),
});

export const adminOriginalUploadProvisionSchema = z.object({
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  contentType: z.string().optional(),
});

export const adminOriginalUploadCompleteSchema = z.object({
  originalId: z.string().min(1),
  strategy: z.unknown().optional(),
  publishAfterReady: z.boolean().optional(),
  mirrorPlan: z.record(z.string(), z.unknown()).optional(),
  preferredProvider: z.string().optional(),
});

export const adminPlaybackRouteSchema = z.object({
  assetId: z.string().min(1),
});

export const adminProviderJobRetrySchema = z.object({
  force: z.boolean().optional(),
});

export const adminMuxUploadSchema = z.object({
  primaryIntent: z.boolean().optional(),
});

export const adminVideoSourceActionSchema = z.object({
  action: z.string(),
});

export const adminCloudflareUploadSchema = z.object({
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  contentType: z.string().optional(),
});
