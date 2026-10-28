import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const sendModerationDecisionEmail = vi.fn();
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/modules/notifications", () => ({ sendNotification: (...args: unknown[]) => sendNotification(...args) }));
vi.mock("@/lib/modules/email", () => ({ sendModerationDecisionEmail: (...args: unknown[]) => sendModerationDecisionEmail(...args) }));

import { createAppContext } from "@/lib/modules/shared/app-context";
import { notifyChannelOwnerOfDecision } from "@/lib/modules/channel/infrastructure/moderation-notice";

/** Audit W20: the in-app notice and the e-mail are separate attempts. */
describe("notifyChannelOwnerOfDecision", () => {
  const prisma = {
    creator: { findUnique: vi.fn(async () => ({ name: "Kanal", userId: "owner", user: { email: "owner@example.com", language: "pl", isDeleted: false } })) },
  };
  const ctx = () => createAppContext({ actor: { type: "system", reason: "test" } as never, prisma: prisma as never });
  const input = { decisionId: "d1", channelId: "c1", action: "VIDEO_REMOVED", reasonPublic: "Naruszenie zasad" };

  beforeEach(() => {
    vi.clearAllMocks();
    sendNotification.mockResolvedValue(undefined);
    sendModerationDecisionEmail.mockResolvedValue(undefined);
  });

  it("still sends the e-mail when the in-app notification fails", async () => {
    sendNotification.mockRejectedValue(new Error("db down"));
    await expect(notifyChannelOwnerOfDecision(ctx(), input)).resolves.toBeUndefined();
    expect(sendModerationDecisionEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.com", decisionId: "d1" }));
  });

  it("sends both when nothing fails, and never throws when the mail transport fails", async () => {
    await notifyChannelOwnerOfDecision(ctx(), input);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendModerationDecisionEmail).toHaveBeenCalledTimes(1);
    sendModerationDecisionEmail.mockRejectedValue(new Error("smtp down"));
    await expect(notifyChannelOwnerOfDecision(ctx(), input)).resolves.toBeUndefined();
  });
});
