import { describe, expect, it, vi } from "vitest";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/modules/notifications/application/notification-preferences.use-cases";
import { updateNotificationPreferencesSchema } from "@/lib/modules/notifications/domain/notification-preferences";

function ctxFor(actor: unknown, stored: Record<string, boolean> | null = null) {
  const notificationPreference = {
    findUnique: vi.fn().mockResolvedValue(stored),
    upsert: vi.fn().mockResolvedValue({}),
  };
  return { ctx: { actor, prisma: { notificationPreference } } as never, notificationPreference };
}

describe("notification preferences", () => {
  it("defaults every toggle to on without a stored row", async () => {
    const { ctx } = ctxFor({ type: "user", userId: "me" });
    expect(await getNotificationPreferences(ctx)).toEqual({ newVideoInApp: true, commentEnabled: true, systemEnabled: true });
  });

  it("saves only the given toggle for the caller", async () => {
    const { ctx, notificationPreference } = ctxFor({ type: "user", userId: "me" }, { newVideoInApp: false, commentEnabled: true, systemEnabled: true });
    const result = await updateNotificationPreferences(ctx, { newVideoInApp: false });
    expect(notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: "me" },
      create: { userId: "me", newVideoInApp: false },
      update: { newVideoInApp: false },
    });
    expect(result.newVideoInApp).toBe(false);
  });

  it("rejects guests", async () => {
    const { ctx } = ctxFor({ type: "guest" });
    await expect(getNotificationPreferences(ctx)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("validates strictly: unknown, e-mail and non-boolean fields are refused", () => {
    expect(updateNotificationPreferencesSchema.safeParse({ commentEnabled: false }).success).toBe(true);
    expect(updateNotificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ userId: "other", systemEnabled: true }).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ newVideoEmail: true }).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ systemEnabled: "yes" }).success).toBe(false);
  });
});
