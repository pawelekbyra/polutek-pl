/**
 * Zod schemas for the JSON bodies of the resumable original-upload routes of the admin panel
 * (apps/admin/app/api/videos/[id]/original-upload/multipart*). Everything else that used to live here
 * belonged to the removed www admin routes (phase 5, docs/architecture/admin-phase5.md); the panel
 * validates its other mutations with its own strict schemas in apps/admin/lib.
 *
 * Unknown extra fields are stripped (zod default), never rejected.
 */
import { z } from "zod";

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
