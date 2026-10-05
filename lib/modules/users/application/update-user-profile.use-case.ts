import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { DEFAULT_AVATAR_URL, avatarRouteUrl, validateAvatarDataUrl } from "@/lib/auth/avatar";
import { validateNickname } from "@/lib/auth/nickname";
import { UserDeletedError, UserNotFoundError } from "../domain/user.errors";
import type { Locale } from "@/lib/i18n/routing";

export class NicknameRejectedError extends AppError {
  constructor(public readonly reason: "too_short" | "too_long" | "invalid_chars" | "taken") {
    super(`Nickname rejected: ${reason}`, reason === "taken" ? 409 : 400, reason === "taken" ? "NICKNAME_TAKEN" : "INVALID_NICKNAME");
  }
}

export class AvatarRejectedError extends AppError {
  constructor() {
    super("Avatar rejected", 400, "INVALID_AVATAR");
  }
}

async function loadActiveUser(ctx: AppContext, userId: string) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, language: true, isDeleted: true, onboardingPending: true },
  });
  if (!user) throw new UserNotFoundError(userId);
  if (user.isDeleted) throw new UserDeletedError(userId);
  return user;
}

async function assertNicknameFree(ctx: AppContext, raw: string, userId: string): Promise<string> {
  const validation = validateNickname(raw);
  if (!validation.ok) throw new NicknameRejectedError(validation.reason);
  const taken = await ctx.prisma.user.findFirst({
    // Placeholders of accounts still in onboarding do not reserve a nickname (audit AUTH-10).
    where: { isDeleted: false, onboardingPending: false, id: { not: userId }, name: { equals: validation.value, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) throw new NicknameRejectedError("taken");
  return validation.value;
}

/** The partial unique index on lower(name) settles a race between two requests for the same nickname. */
async function withNicknameRace<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "P2002") throw new NicknameRejectedError("taken");
    throw error;
  }
}

type StoredAvatar = { data: Uint8Array<ArrayBuffer>; mime: string };

function resolveAvatar(value: string | null | undefined): StoredAvatar | null {
  if (value == null) return null;
  const checked = validateAvatarDataUrl(value);
  if (!checked.ok) throw new AvatarRejectedError();
  return { data: new Uint8Array(checked.bytes), mime: checked.mime };
}

async function saveAvatar(ctx: AppContext, userId: string, stored: StoredAvatar) {
  await ctx.prisma.userAvatar.upsert({
    where: { userId },
    update: stored,
    create: { userId, ...stored },
  });
}

/** Changes the nickname (the only display name) with the same rules and taken check as sign-up. */
export async function updateNickname(ctx: AppContext, input: { userId: string; nickname: string }) {
  await loadActiveUser(ctx, input.userId);
  const name = await assertNicknameFree(ctx, input.nickname, input.userId);
  await withNicknameRace(() => ctx.prisma.user.update({ where: { id: input.userId }, data: { name } }));
  await recordAuditEventSafe(ctx, { action: "USER_NICKNAME_CHANGED", targetType: "User", targetId: input.userId });
  return { name };
}

/** Stores a validated, browser-resized avatar (served by /api/avatars), or restores the default one when `dataUrl` is null. */
export async function updateAvatar(ctx: AppContext, input: { userId: string; dataUrl: string | null }) {
  await loadActiveUser(ctx, input.userId);
  const stored = resolveAvatar(input.dataUrl);
  const imageUrl = stored ? avatarRouteUrl(input.userId) : DEFAULT_AVATAR_URL;
  if (stored) await saveAvatar(ctx, input.userId, stored);
  else await ctx.prisma.userAvatar.deleteMany({ where: { userId: input.userId } });
  await ctx.prisma.user.update({ where: { id: input.userId }, data: { imageUrl } });
  return { imageUrl };
}

/**
 * First-sign-in step for every new account (e-mail or Google) and for older accounts whose name broke
 * the nickname rules: the nickname (and optional avatar) the viewer picks replace the placeholder.
 * Returns the user so the caller can send the welcome e-mail exactly once.
 */
export async function completeOnboarding(
  ctx: AppContext,
  input: { userId: string; nickname: string; avatarDataUrl?: string | null; language?: Locale },
) {
  const user = await loadActiveUser(ctx, input.userId);
  if (!user.onboardingPending) throw new AppError("Onboarding already completed", 409, "ONBOARDING_DONE");
  const name = await assertNicknameFree(ctx, input.nickname, input.userId);
  const avatar = resolveAvatar(input.avatarDataUrl);
  if (avatar) await saveAvatar(ctx, input.userId, avatar);
  const updated = await withNicknameRace(() =>
    ctx.prisma.user.update({
      where: { id: input.userId },
      data: {
        name,
        onboardingPending: false,
        // The language chosen in the dialog is what every later e-mail (the welcome one first) uses.
        ...(input.language ? { language: input.language } : {}),
        ...(avatar ? { imageUrl: avatarRouteUrl(input.userId) } : {}),
      },
      select: { email: true, name: true, language: true, createdAt: true },
    }),
  );
  return updated;
}
