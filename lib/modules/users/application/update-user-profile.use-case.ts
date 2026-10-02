import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { DEFAULT_AVATAR_URL, validateAvatarDataUrl } from "@/lib/auth/avatar";
import { validateNickname } from "@/lib/auth/nickname";
import { UserDeletedError, UserNotFoundError } from "../domain/user.errors";

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
    where: { isDeleted: false, id: { not: userId }, name: { equals: validation.value, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) throw new NicknameRejectedError("taken");
  return validation.value;
}

function resolveAvatar(value: string | null | undefined): string | null {
  if (value == null) return null;
  const checked = validateAvatarDataUrl(value);
  if (!checked.ok) throw new AvatarRejectedError();
  return checked.value;
}

/** Changes the nickname (the only display name) with the same rules and taken check as sign-up. */
export async function updateNickname(ctx: AppContext, input: { userId: string; nickname: string }) {
  await loadActiveUser(ctx, input.userId);
  const name = await assertNicknameFree(ctx, input.nickname, input.userId);
  await ctx.prisma.user.update({ where: { id: input.userId }, data: { name } });
  await recordAuditEventSafe(ctx, { action: "USER_NICKNAME_CHANGED", targetType: "User", targetId: input.userId });
  return { name };
}

/** Sets a validated, browser-resized avatar, or restores the default one when `dataUrl` is null. */
export async function updateAvatar(ctx: AppContext, input: { userId: string; dataUrl: string | null }) {
  await loadActiveUser(ctx, input.userId);
  const imageUrl = resolveAvatar(input.dataUrl) ?? DEFAULT_AVATAR_URL;
  await ctx.prisma.user.update({ where: { id: input.userId }, data: { imageUrl } });
  return { imageUrl };
}

/**
 * First-sign-in step for accounts created through Google: the nickname (and optional avatar) the
 * viewer picks replace the provider placeholder. Returns the user so the caller can send the
 * welcome e-mail exactly once.
 */
export async function completeOnboarding(
  ctx: AppContext,
  input: { userId: string; nickname: string; avatarDataUrl?: string | null },
) {
  const user = await loadActiveUser(ctx, input.userId);
  if (!user.onboardingPending) throw new AppError("Onboarding already completed", 409, "ONBOARDING_DONE");
  const name = await assertNicknameFree(ctx, input.nickname, input.userId);
  const avatar = resolveAvatar(input.avatarDataUrl);
  const updated = await ctx.prisma.user.update({
    where: { id: input.userId },
    data: { name, onboardingPending: false, ...(avatar ? { imageUrl: avatar } : {}) },
    select: { email: true, name: true, language: true },
  });
  return updated;
}
