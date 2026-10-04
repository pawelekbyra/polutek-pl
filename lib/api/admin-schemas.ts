/**
 * Zod schemas for the JSON bodies of mutating /api/admin routes.
 *
 * Rules kept on purpose:
 *  - Unknown extra fields are stripped (zod default), never rejected, so the
 *    current admin UI payloads keep working.
 *  - Routes that hand a large, use-case-validated payload straight through
 *    (video metadata) only assert "a JSON object" here via
 *    `adminLooseObjectSchema`; their domain validation lives in the use case.
 */
import { z } from "zod";
import { CommentDeletedReason } from "@prisma/client";
import { currencySchema } from "@/lib/payments/checkout.schema";

/** Any JSON object (arrays, null and scalars are rejected). Keys are kept. */
export const adminLooseObjectSchema = z.record(z.string(), z.unknown());

export const adminCommentReportResolveSchema = z.object({
  status: z.enum(["DISMISSED", "ACTION_TAKEN"]),
});

export const adminCommentDeleteSchema = z.object({
  reason: z.nativeEnum(CommentDeletedReason).nullish(),
});

const broadcastContentShape = {
  subjectPl: z.string().trim().min(1).max(200),
  htmlPl: z.string().min(1).max(100_000),
  subjectEn: z.string().trim().max(200).nullish(),
  htmlEn: z.string().max(100_000).nullish(),
};

/** POST /api/admin/emails/broadcast: create (queue) a broadcast. One audience, no recipient list. */
export const adminBroadcastCreateSchema = z.object({
  ...broadcastContentShape,
  requestKey: z.string().uuid(),
});

/** POST /api/admin/emails/broadcast/test: a test copy to the signed-in admin's own address. */
export const adminBroadcastTestSchema = z.object({
  ...broadcastContentShape,
  language: z.enum(["pl", "en"]).default("pl"),
});

/** POST /api/admin/templates. Slug of a system mail (override) or an admin template. */
export const adminEmailTemplateSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(255).nullish(),
  subject: z.string().trim().min(1).max(150),
  html: z.string().min(1).max(50_000),
  subjectEn: z.string().trim().max(150).nullish(),
  htmlEn: z.string().max(50_000).nullish(),
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

/** DELETE /api/admin/users/[userId]: the user's e-mail typed back; the route checks it matches (case-insensitive). */
export const adminUserDeleteSchema = z.object({
  confirmEmail: z.string().trim().max(320).optional(),
});

/** PATCH /api/admin/users/[userId]/role */
export const adminUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
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

/**
 * Scheduled premiere on a video write (CLAUDE.md "Premieres"): an ISO 8601
 * timestamp with an offset (the admin form sends UTC), `null` = publish now,
 * absent = unchanged. "Must be in the future" is checked by the use case,
 * which knows the stored value.
 */
export const adminVideoPremiereAtSchema = z.string().datetime({ offset: true }).nullable().optional();

/** Largest fundraising goal accepted: 10 000 000 units (fits a Postgres INTEGER in minor units). */
export const MAX_FUNDRAISING_GOAL_MINOR = 1_000_000_000;

/**
 * Fundraising goal on a video write (CLAUDE.md "Fundraising progress bar"):
 * `null` removes the goal (no bar), absent = unchanged. `startAt` (ISO, or null
 * = count every tip ever) is when tips start counting towards it.
 */
export const adminVideoFundraisingGoalSchema = z
  .object({
    amountMinor: z.number().int().positive().max(MAX_FUNDRAISING_GOAL_MINOR),
    currency: currencySchema,
    startAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .nullable()
  .optional();

/**
 * Hand-set fill of the fundraising bar (whole percent 0..100): `null` turns it
 * off (the goal computation, if any, applies again), absent = unchanged.
 */
export const adminVideoFundraisingManualPercentSchema = z.number().int().min(0).max(100).nullable().optional();

/** Video metadata writes: any object (fields whitelisted by the use case) with a valid premiereAt/goal. */
export const adminVideoWriteSchema = z
  .object({
    premiereAt: adminVideoPremiereAtSchema,
    fundraisingGoal: adminVideoFundraisingGoalSchema,
    fundraisingManualPercent: adminVideoFundraisingManualPercentSchema,
  })
  .passthrough();

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
    ]),
  });

// ---- own video pipeline: resumable multipart upload to R2 (lib/modules/video-pipeline) ----

export const adminMultipartStartSchema = z.object({
  fileName: z.string().min(1).max(300),
  fileSize: z.number().int().positive(),
  contentType: z.string().max(100).optional(),
});

export const adminMultipartPartsSchema = z.object({
  originalId: z.string().min(1).max(64),
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(50),
});

export const adminMultipartCompleteSchema = z.object({
  originalId: z.string().min(1).max(64),
  parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) })).min(1).max(10_000),
  publishAfterReady: z.boolean().optional(),
});
