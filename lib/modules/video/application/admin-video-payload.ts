import { AccessTier, VideoStatus } from "@prisma/client";
import type { CreateVideoInput, UpdateVideoInput } from "@/lib/modules/video";

export type AdminVideoRequestBody = Record<string, unknown>;

export function isAdminVideoRequestBody(value: unknown): value is AdminVideoRequestBody {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readTextField(body: AdminVideoRequestBody, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function readNullableTextField(
  body: AdminVideoRequestBody,
  key: string,
): string | null | undefined {
  const value = body[key];
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function readBooleanField(body: AdminVideoRequestBody, key: string): boolean | undefined {
  const value = body[key];
  return typeof value === "boolean" ? value : undefined;
}

function readNumberField(body: AdminVideoRequestBody, key: string): number | undefined {
  const value = body[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readAccessTier(body: AdminVideoRequestBody, key: string): AccessTier | undefined {
  const value = body[key];
  if (typeof value !== "string") return undefined;
  return Object.values(AccessTier).includes(value as AccessTier)
    ? (value as AccessTier)
    : undefined;
}

function readVideoStatus(body: AdminVideoRequestBody, key: string): VideoStatus | undefined {
  const value = body[key];
  if (typeof value !== "string") return undefined;
  return Object.values(VideoStatus).includes(value as VideoStatus)
    ? (value as VideoStatus)
    : undefined;
}

export function buildAdminVideoUpdatePayload(body: AdminVideoRequestBody): UpdateVideoInput {
  const payload: UpdateVideoInput = {
    id: readTextField(body, "id") ?? "",
  };

  const title = readTextField(body, "title");
  if (title !== undefined) payload.title = title;

  const slug = readTextField(body, "slug");
  if (slug !== undefined) payload.slug = slug;

  const description = readNullableTextField(body, "description");
  if (description !== undefined) payload.description = description;

  const descriptionEn = readNullableTextField(body, "descriptionEn");
  if (descriptionEn !== undefined) payload.descriptionEn = descriptionEn;

  const duration = readNullableTextField(body, "duration");
  if (duration !== undefined) payload.duration = duration;

  const thumbnailUrl = readNullableTextField(body, "thumbnailUrl");
  if (thumbnailUrl !== undefined) payload.thumbnailUrl = thumbnailUrl;

  const titleEn = readNullableTextField(body, "titleEn");
  if (titleEn !== undefined) payload.titleEn = titleEn;

  const videoUrl = readNullableTextField(body, "videoUrl");
  if (videoUrl !== undefined) payload.videoUrl = videoUrl;

  const tier = readAccessTier(body, "tier");
  if (tier !== undefined) payload.tier = tier;

  const status = readVideoStatus(body, "status");
  if (status !== undefined) payload.status = status;

  const isMainFeatured = readBooleanField(body, "isMainFeatured");
  if (isMainFeatured !== undefined) payload.isMainFeatured = isMainFeatured;

  const showInSidebar = readBooleanField(body, "showInSidebar");
  if (showInSidebar !== undefined) payload.showInSidebar = showInSidebar;

  const sidebarOrder = readNumberField(body, "sidebarOrder");
  if (sidebarOrder !== undefined) payload.sidebarOrder = sidebarOrder;

  return payload;
}

export function buildAdminVideoCreatePayload(body: AdminVideoRequestBody): CreateVideoInput {
  const payload: CreateVideoInput = {
    title: readTextField(body, "title") ?? "",
    slug: readTextField(body, "slug") ?? "",
    tier: readAccessTier(body, "tier") ?? AccessTier.PUBLIC,
    publishAfterAssetReady: readBooleanField(body, "publishAfterAssetReady") === true,
  };

  const description = readNullableTextField(body, "description");
  if (description !== undefined) payload.description = description;

  const descriptionEn = readNullableTextField(body, "descriptionEn");
  if (descriptionEn !== undefined) payload.descriptionEn = descriptionEn;

  const duration = readNullableTextField(body, "duration");
  if (duration !== undefined) payload.duration = duration;

  const thumbnailUrl = readNullableTextField(body, "thumbnailUrl");
  if (thumbnailUrl !== undefined) payload.thumbnailUrl = thumbnailUrl;

  const titleEn = readNullableTextField(body, "titleEn");
  if (titleEn !== undefined) payload.titleEn = titleEn;

  return payload;
}
