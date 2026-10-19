import { Prisma } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import type { WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import { gateMode } from "@/lib/platform-gates";
import { defaultLimitsFor } from "@/lib/platform-limits";
import { handleCandidates, validateChannelName, validateHandle } from "../domain/handle";
import { MainChannelService, isMainChannelId } from "./main-channel.service";

/**
 * Channel lifecycle: create, rename, change handle, delete and restore (docs/architecture/multi-creator-platform.md).
 *
 * Every function authorizes through lib/modules/authz first and writes one audit event with the channel id.
 * Creating a channel is behind the `channelCreation` gate (off unless the owner opens it, CLAUDE.md 4.24).
 */

/** How long an old handle stays reserved for its channel and redirects to the new one. */
export const HANDLE_RESERVATION_DAYS = 180;
/** A channel deleted by its owner can be restored for this long, then it is purged. */
export const CHANNEL_DELETION_GRACE_DAYS = 30;
/** At most this many name or handle changes inside the window (same rule as YouTube). */
export const NAME_CHANGE_LIMIT = 2;
export const NAME_CHANGE_WINDOW_DAYS = 14;
export const CHANNEL_BIO_MAX_LENGTH = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

const SETTING_MAX_CHANNELS = "max_channels_per_user";
const SETTING_INVITES = "channel_creation_invites";
const SETTING_AUTO_APPROVE = "channel_auto_approve";

export interface ChannelSummaryDto {
  id: string;
  slug: string;
  handle: string | null;
  name: string;
  bio: string | null;
  status: string;
  isVerified: boolean;
  language: string | null;
  country: string | null;
}

const SUMMARY_SELECT = {
  id: true,
  slug: true,
  handle: true,
  name: true,
  bio: true,
  status: true,
  isVerified: true,
  language: true,
  country: true,
} as const;

function dayMs(days: number) {
  return days * DAY_MS;
}

function userIdOf(ctx: AppContext): string | null {
  return ctx.actor.type === "user" ? ctx.actor.userId : null;
}

async function settingValue(ctx: AppContext, key: string): Promise<string | null> {
  const row = await ctx.prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function isInvited(ctx: AppContext, userId: string): Promise<boolean> {
  const raw = await settingValue(ctx, SETTING_INVITES);
  if (!raw) return false;
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!Array.isArray(list)) return false;
  const user = await ctx.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const wanted = new Set(list.filter((v): v is string => typeof v === "string").map((v) => v.trim().toLowerCase()));
  return wanted.has(userId.toLowerCase()) || (!!user?.email && wanted.has(user.email.toLowerCase()));
}

async function maxChannelsPerUser(ctx: AppContext): Promise<number> {
  const raw = await settingValue(ctx, SETTING_MAX_CHANNELS);
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export type HandleAvailability =
  | { available: true; handle: string }
  | { available: false; handle: string; reason: string; code: string; suggestions: string[] };

/** Validity, then uniqueness against every channel's handle and slug and against handles still reserved by another channel. */
export async function checkHandleAvailability(
  ctx: AppContext,
  rawHandle: string,
  options: { exceptChannelId?: string; suggestFrom?: string } = {},
): Promise<HandleAvailability> {
  const check = validateHandle(rawHandle);
  if (!check.ok) {
    return { available: false, handle: rawHandle, reason: check.message, code: check.problem, suggestions: [] };
  }
  const handle = check.handle;
  const db = ctx.prisma;
  const [taken, reserved] = await Promise.all([
    db.creator.findFirst({
      where: {
        OR: [{ handle: { equals: handle, mode: "insensitive" } }, { slug: { equals: handle, mode: "insensitive" } }],
        ...(options.exceptChannelId ? { id: { not: options.exceptChannelId } } : {}),
      },
      select: { id: true },
    }),
    db.channelHandleHistory.findFirst({
      where: {
        handle,
        reservedUntil: { gt: ctx.now() },
        ...(options.exceptChannelId ? { channelId: { not: options.exceptChannelId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  if (!taken && !reserved) return { available: true, handle };

  const candidates = handleCandidates(options.suggestFrom ?? handle).filter((c) => c !== handle);
  const free: string[] = [];
  for (const candidate of candidates) {
    const result = await checkHandleAvailabilityShallow(ctx, candidate, options.exceptChannelId);
    if (result) free.push(candidate);
    if (free.length >= 3) break;
  }
  return { available: false, handle, reason: "Ten uchwyt jest już zajęty.", code: "TAKEN", suggestions: free };
}

async function checkHandleAvailabilityShallow(ctx: AppContext, handle: string, exceptChannelId?: string): Promise<boolean> {
  const db = ctx.prisma;
  const [taken, reserved] = await Promise.all([
    db.creator.findFirst({
      where: {
        OR: [{ handle: { equals: handle, mode: "insensitive" } }, { slug: { equals: handle, mode: "insensitive" } }],
        ...(exceptChannelId ? { id: { not: exceptChannelId } } : {}),
      },
      select: { id: true },
    }),
    db.channelHandleHistory.findFirst({
      where: { handle, reservedUntil: { gt: ctx.now() }, ...(exceptChannelId ? { channelId: { not: exceptChannelId } } : {}) },
      select: { id: true },
    }),
  ]);
  return !taken && !reserved;
}

export interface CreateChannelInput {
  name: string;
  handle: string;
  language?: string | null;
  country?: string | null;
}

/** Whether this account may create a channel right now: gate on, or gate on invite and the account is invited. */
export async function canCreateChannel(ctx: AppContext): Promise<boolean> {
  const mode = gateMode("channelCreation");
  if (mode === "on") return true;
  if (mode !== "invite") return false;
  const userId = userIdOf(ctx);
  return userId ? isInvited(ctx, userId) : false;
}

export async function createChannel(
  ctx: AppContext,
  input: CreateChannelInput,
): Promise<UseCaseResult<ChannelSummaryDto, AppError>> {
  const mode = gateMode("channelCreation");
  if (mode === "off") {
    return fail(new AppError("Zakładanie kanałów nie jest jeszcze otwarte.", 403, "CHANNEL_CREATION_CLOSED"));
  }
  const userId = userIdOf(ctx);
  if (!userId) return fail(new AppError("Zaloguj się, aby założyć kanał.", 401, "UNAUTHENTICATED"));

  const denied = await authorize(ctx, "channel.create");
  if (denied) return fail(denied);

  if (mode === "invite" && !(await isInvited(ctx, userId))) {
    return fail(new AppError("Zakładanie kanałów jest na razie tylko na zaproszenie.", 403, "CHANNEL_INVITE_REQUIRED"));
  }

  const name = validateChannelName(input.name);
  if (!name.ok) return fail(new AppError(name.message, 400, `CHANNEL_NAME_${name.problem}`));

  const owned = await ctx.prisma.creator.count({ where: { userId, deletedAt: null } });
  if (owned >= (await maxChannelsPerUser(ctx))) {
    return fail(new AppError("Masz już maksymalną liczbę kanałów.", 409, "CHANNEL_LIMIT_REACHED"));
  }

  const availability = await checkHandleAvailability(ctx, input.handle, { suggestFrom: name.name });
  if (!availability.available) {
    return fail(new AppError(availability.reason, availability.code === "TAKEN" ? 409 : 400, `CHANNEL_HANDLE_${availability.code}`));
  }
  const handle = availability.handle;

  // Invited channels are trusted; open channels wait for review until staff or `channel_auto_approve` lets them through.
  const autoApprove = (await settingValue(ctx, SETTING_AUTO_APPROVE)) === "true";
  const status = mode === "invite" || autoApprove ? "ACTIVE" : "PENDING_REVIEW";
  const now = ctx.now();
  const limits = defaultLimitsFor(0);

  try {
    const channel = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const created = await tx.creator.create({
        data: {
          userId,
          slug: handle,
          handle,
          name: name.name,
          status,
          language: input.language ?? null,
          country: input.country ?? null,
        },
        select: SUMMARY_SELECT,
      });
      await tx.channelMember.create({ data: { channelId: created.id, userId, role: "OWNER", acceptedAt: now } });
      await tx.channelQuota.create({
        data: {
          channelId: created.id,
          trustLevel: 0,
          maxStorageBytes: BigInt(limits.maxStorageBytes),
          maxUploadBytes: BigInt(limits.maxUploadBytes),
          maxVideoSeconds: limits.maxVideoSeconds,
          maxUploadsPerDay: limits.maxUploadsPerDay,
          maxQueuedJobs: limits.maxQueuedJobs,
        },
      });
      await recordAuditEvent(ctx, {
        action: "CHANNEL_CREATED",
        targetType: "Creator",
        targetId: created.id,
        channelId: created.id,
        metadata: { handle, status },
      }, tx);
      return created;
    });
    return ok(channel);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new AppError("Ten uchwyt został właśnie zajęty. Wybierz inny.", 409, "CHANNEL_HANDLE_TAKEN"));
    }
    throw error;
  }
}

/** Counts this channel's audit events of one kind inside the rate-limit window. */
async function recentChanges(ctx: AppContext, channelId: string, action: string): Promise<number> {
  const since = new Date(ctx.now().getTime() - dayMs(NAME_CHANGE_WINDOW_DAYS));
  return ctx.prisma.auditLog.count({ where: { channelId, action, createdAt: { gte: since } } });
}

export interface UpdateChannelProfileInput {
  name?: string;
  bio?: string | null;
  language?: string | null;
  country?: string | null;
}

/** Owner edits of the channel profile: name (rate limited), bio, language and country. */
export async function updateChannelProfile(
  ctx: AppContext,
  input: UpdateChannelProfileInput,
): Promise<UseCaseResult<ChannelSummaryDto, AppError>> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "channel.update", {
    channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status },
  });
  if (denied) return fail(denied);

  const data: Prisma.CreatorUpdateInput = {};
  let renamed = false;
  if (input.name !== undefined) {
    const name = validateChannelName(input.name, { allowBrand: ctx.actor.type === "admin" || (await isMainChannelId(ctx.prisma, channel.id)) });
    if (!name.ok) return fail(new AppError(name.message, 400, `CHANNEL_NAME_${name.problem}`));
    if (name.name !== channel.name) {
      if ((await recentChanges(ctx, channel.id, "CHANNEL_RENAMED")) >= NAME_CHANGE_LIMIT) {
        return fail(new AppError("Nazwę kanału można zmienić najwyżej dwa razy na 14 dni.", 429, "CHANNEL_RENAME_RATE_LIMITED"));
      }
      data.name = name.name;
      renamed = true;
    }
  }
  if (input.bio !== undefined) {
    const bio = input.bio === null ? null : input.bio.trim();
    if (bio !== null && [...bio].length > CHANNEL_BIO_MAX_LENGTH) {
      return fail(new AppError(`Opis kanału ma najwyżej ${CHANNEL_BIO_MAX_LENGTH} znaków.`, 400, "CHANNEL_BIO_TOO_LONG"));
    }
    data.bio = bio || null;
  }
  if (input.language !== undefined) data.language = input.language;
  if (input.country !== undefined) data.country = input.country;
  if (Object.keys(data).length === 0) return ok(await loadSummary(ctx, channel.id));

  const updated = await ctx.db.writeTransaction(async (tx: WriteTx) => {
    const row = await tx.creator.update({ where: { id: channel.id }, data, select: SUMMARY_SELECT });
    await recordAuditEvent(ctx, {
      action: renamed ? "CHANNEL_RENAMED" : "CHANNEL_PROFILE_UPDATED",
      targetType: "Creator",
      targetId: channel.id,
      channelId: channel.id,
      metadata: { fields: Object.keys(data), ...(renamed ? { before: channel.name, after: data.name as string } : {}) },
    }, tx);
    return row;
  });
  return ok(updated);
}

async function loadSummary(ctx: AppContext, id: string): Promise<ChannelSummaryDto> {
  const row = await ctx.prisma.creator.findUniqueOrThrow({ where: { id }, select: SUMMARY_SELECT });
  return row;
}

/**
 * Changes the channel's @handle. The old handle stays reserved for `HANDLE_RESERVATION_DAYS` and redirects to the
 * new one. The slug (the stable `/channel/<slug>` address) never changes with the handle.
 */
export async function changeChannelHandle(
  ctx: AppContext,
  rawHandle: string,
): Promise<UseCaseResult<ChannelSummaryDto, AppError>> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "channel.update", {
    channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status },
  });
  if (denied) return fail(denied);

  const availability = await checkHandleAvailability(ctx, rawHandle, { exceptChannelId: channel.id });
  if (!availability.available) {
    return fail(new AppError(availability.reason, availability.code === "TAKEN" ? 409 : 400, `CHANNEL_HANDLE_${availability.code}`));
  }
  const next = availability.handle;
  if (channel.handle && channel.handle.toLowerCase() === next) return ok(await loadSummary(ctx, channel.id));

  if ((await recentChanges(ctx, channel.id, "CHANNEL_HANDLE_CHANGED")) >= NAME_CHANGE_LIMIT) {
    return fail(new AppError("Uchwyt można zmienić najwyżej dwa razy na 14 dni.", 429, "CHANNEL_HANDLE_RATE_LIMITED"));
  }

  const now = ctx.now();
  try {
    const updated = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      if (channel.handle) {
        await tx.channelHandleHistory.create({
          data: { channelId: channel.id, handle: channel.handle.toLowerCase(), reservedUntil: new Date(now.getTime() + dayMs(HANDLE_RESERVATION_DAYS)) },
        });
      }
      const row = await tx.creator.update({ where: { id: channel.id }, data: { handle: next }, select: SUMMARY_SELECT });
      await recordAuditEvent(ctx, {
        action: "CHANNEL_HANDLE_CHANGED",
        targetType: "Creator",
        targetId: channel.id,
        channelId: channel.id,
        metadata: { before: channel.handle ?? null, after: next },
      }, tx);
      return row;
    });
    return ok(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(new AppError("Ten uchwyt został właśnie zajęty. Wybierz inny.", 409, "CHANNEL_HANDLE_TAKEN"));
    }
    throw error;
  }
}

/** Soft delete: the channel disappears at once and is purged after the grace period unless restored. */
export async function requestChannelDeletion(ctx: AppContext): Promise<UseCaseResult<{ deleteAfter: Date }, AppError>> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "channel.delete", {
    channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status },
  });
  if (denied) return fail(denied);
  if (await isMainChannelId(ctx.prisma, channel.id)) {
    return fail(new AppError("Kanału głównego platformy nie można usunąć tą drogą.", 409, "CHANNEL_PRIMARY_PROTECTED"));
  }

  const now = ctx.now();
  const deleteAfter = new Date(now.getTime() + dayMs(CHANNEL_DELETION_GRACE_DAYS));
  await ctx.db.writeTransaction(async (tx: WriteTx) => {
    await tx.creator.update({
      where: { id: channel.id },
      data: { status: "DELETED", deletedAt: now, deleteAfter, statusChangedAt: now, statusReason: "OWNER_DELETED" },
    });
    await recordAuditEvent(ctx, {
      action: "CHANNEL_DELETION_REQUESTED",
      targetType: "Creator",
      targetId: channel.id,
      channelId: channel.id,
      metadata: { deleteAfter: deleteAfter.toISOString() },
    }, tx);
  });
  return ok({ deleteAfter });
}

/** Restores a channel its owner deleted, while the grace period lasts. */
export async function restoreChannel(ctx: AppContext, channelId: string): Promise<UseCaseResult<ChannelSummaryDto, AppError>> {
  const row = await ctx.prisma.creator.findUnique({
    where: { id: channelId },
    select: { id: true, userId: true, status: true, deletedAt: true, deleteAfter: true, statusReason: true },
  });
  if (!row || row.status !== "DELETED") return fail(new AppError("Nie znaleziono kanału do przywrócenia.", 404, "CHANNEL_NOT_FOUND"));

  const denied = await authorize(ctx, "channel.restore", {
    channel: { id: row.id, ownerUserId: row.userId, status: row.status },
  });
  if (denied) return fail(denied);
  // Only the owner's own deletion can be undone by the owner; a deletion by staff is staff's to reverse.
  if (row.statusReason !== "OWNER_DELETED" && ctx.actor.type !== "admin") {
    return fail(new AppError("Ten kanał usunął administrator platformy.", 403, "FORBIDDEN"));
  }
  if (row.deleteAfter && row.deleteAfter.getTime() <= ctx.now().getTime()) {
    return fail(new AppError("Okres przywracania kanału minął.", 410, "CHANNEL_RESTORE_EXPIRED"));
  }

  const now = ctx.now();
  const restored = await ctx.db.writeTransaction(async (tx: WriteTx) => {
    const updated = await tx.creator.update({
      where: { id: row.id },
      data: { status: "ACTIVE", deletedAt: null, deleteAfter: null, statusChangedAt: now, statusReason: null },
      select: SUMMARY_SELECT,
    });
    await recordAuditEvent(ctx, {
      action: "CHANNEL_RESTORED",
      targetType: "Creator",
      targetId: row.id,
      channelId: row.id,
    }, tx);
    return updated;
  });
  return ok(restored);
}

/** The channels a user belongs to (MVP: at most one owned channel), newest first. Nothing for guests. */
export async function listMyChannels(ctx: AppContext): Promise<ChannelSummaryDto[]> {
  const userId = userIdOf(ctx);
  if (!userId) return [];
  const members = await ctx.prisma.channelMember.findMany({
    where: { userId, channel: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { channel: { select: SUMMARY_SELECT } },
  });
  if (members.length > 0) return members.map((m) => m.channel);
  // Rows created before ChannelMember existed are covered by the owner column.
  return ctx.prisma.creator.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: SUMMARY_SELECT });
}
