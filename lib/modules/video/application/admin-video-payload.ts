import { VideoStatus } from "@prisma/client";
import { parseVideoAccessTier, type VideoAccessTier } from "@/lib/access-tier";
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

/**
 * Scheduled premiere: `null` = publish now (clears it), an ISO string = that
 * moment, anything else = not sent. Routes validate the format first.
 */
function readPremiereAt(body: AdminVideoRequestBody): Date | null | undefined {
  const value = body.premiereAt;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Fundraising goal (CLAUDE.md "Fundraising progress bar") → video columns.
 * `null` clears the goal, a `{ amountMinor, currency, startAt }` object sets it,
 * anything else = not sent. Routes validate the shape first
 * (`adminVideoFundraisingGoalSchema`).
 */
export function fundraisingGoalUpdateFields(value: unknown): Pick<UpdateVideoInput, "fundraisingGoalMinor" | "fundraisingGoalCurrency" | "fundraisingStartAt"> {
  if (value === null) return { fundraisingGoalMinor: null, fundraisingGoalCurrency: null, fundraisingStartAt: null };
  if (!value || typeof value !== "object") return {};
  const goal = value as { amountMinor?: unknown; currency?: unknown; startAt?: unknown };
  if (typeof goal.amountMinor !== "number" || typeof goal.currency !== "string") return {};
  const startAt = typeof goal.startAt === "string" ? new Date(goal.startAt) : null;
  return {
    fundraisingGoalMinor: goal.amountMinor,
    fundraisingGoalCurrency: goal.currency.toUpperCase(),
    fundraisingStartAt: startAt && !Number.isNaN(startAt.getTime()) ? startAt : null,
  };
}

// Two levels (lib/access-tier.ts); an old client sending PATRON gets LOGGED_IN.
function readAccessTier(body: AdminVideoRequestBody, key: string): VideoAccessTier | undefined {
  return parseVideoAccessTier(body[key]) ?? undefined;
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

  const subtitleUrlPl = readNullableTextField(body, "subtitleUrlPl");
  if (subtitleUrlPl !== undefined) payload.subtitleUrlPl = subtitleUrlPl;

  const subtitleUrlEn = readNullableTextField(body, "subtitleUrlEn");
  if (subtitleUrlEn !== undefined) payload.subtitleUrlEn = subtitleUrlEn;

  const premiereAt = readPremiereAt(body);
  if (premiereAt !== undefined) payload.premiereAt = premiereAt;

  Object.assign(payload, fundraisingGoalUpdateFields(body.fundraisingGoal));

  const manualPercent = body.fundraisingManualPercent;
  if (manualPercent === null || (typeof manualPercent === "number" && Number.isInteger(manualPercent) && manualPercent >= 0 && manualPercent <= 100)) {
    payload.fundraisingManualPercent = manualPercent;
  }

  return payload;
}

export function buildAdminVideoCreatePayload(body: AdminVideoRequestBody): CreateVideoInput {
  const payload: CreateVideoInput = {
    title: readTextField(body, "title") ?? "",
    slug: readTextField(body, "slug") ?? "",
    tier: readAccessTier(body, "tier") ?? "PUBLIC",
    publishAfterAssetReady: readBooleanField(body, "publishAfterAssetReady") === true,
  };

  const publishAfterAssetReadyProvider = readNullableTextField(body, "publishAfterAssetReadyProvider");
  if (publishAfterAssetReadyProvider !== undefined) payload.publishAfterAssetReadyProvider = publishAfterAssetReadyProvider;

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

  const premiereAt = readPremiereAt(body);
  if (premiereAt !== undefined) payload.premiereAt = premiereAt;

  return payload;
}
