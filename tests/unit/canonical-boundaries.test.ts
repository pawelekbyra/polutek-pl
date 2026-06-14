import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkVideoAccess } from "@/lib/modules/access/application/check-video-access.use-case";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { AccessTier, VideoStatus } from "@prisma/client";
import { MainChannelService } from "@/lib/modules/channel";
import { CommentPolicy } from "@/lib/modules/comments/domain/comment.policy";

vi.mock("@/lib/modules/channel", () => ({
  MainChannelService: {
    getRequired: vi.fn().mockResolvedValue({ id: "main_channel_id", slug: "main-slug" }),
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  canUseDemoFallbacks: vi.fn().mockReturnValue(false),
}));

describe("Canonical Boundaries Verification", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  const mockPrisma = {
    video: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    creator: {
        findUnique: vi.fn().mockResolvedValue({ id: "main_channel_id", subscribersCount: 0, displaySubscribersCount: 0 })
    }
  };

  const createCtx = (actor: any) => createAppContext({ actor, prisma: mockPrisma as any, now: () => now });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Video Access - Revoked Admin", () => {
    it("VERIFY: Revoked admin (USER type actor) cannot access draft/private videos", async () => {
      const revokedAdminActor = { type: "user" as const, userId: "revoked_1", isPatron: false };
      const ctx = createCtx(revokedAdminActor);

      const draftVideo = {
        id: "v1",
        creatorId: "main_channel_id",
        status: VideoStatus.DRAFT,
        tier: AccessTier.PUBLIC,
        publishedAt: null,
        creator: { id: "main_channel_id", isApproved: true, isPrimary: true }
      };

      mockPrisma.video.findFirst.mockResolvedValue(draftVideo);

      const result = await checkVideoAccess({ videoIdOrSlug: "v1" }, ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(false);
        expect(result.data.reason).toBe("NOT_FOUND"); // Canonical visibility for users
      }
    });

    it("VERIFY: Active admin (ADMIN type actor) CAN access draft videos", async () => {
      const activeAdminActor = { type: "admin" as const, userId: "admin_1" };
      const ctx = createCtx(activeAdminActor);

      const draftVideo = {
        id: "v1",
        creatorId: "main_channel_id",
        status: VideoStatus.DRAFT,
        tier: AccessTier.PUBLIC,
        publishedAt: null,
        creator: { id: "main_channel_id", isApproved: true, isPrimary: true }
      };

      mockPrisma.video.findFirst.mockResolvedValue(draftVideo);

      const result = await checkVideoAccess({ videoIdOrSlug: "v1" }, ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasAccess).toBe(true);
      }
    });
  });

  describe("Comment Policy - Revoked Admin", () => {
    it("VERIFY: Actor of type 'user' (revoked admin) cannot perform moderator actions", () => {
        const revokedAdminActor = { type: "user" as const, userId: "revoked_1", isPatron: false };

        expect(CommentPolicy.canModerateComment(revokedAdminActor, false)).toBe(false);
        expect(CommentPolicy.canDeleteComment(revokedAdminActor, "other_author", false)).toBe(false);
        expect(CommentPolicy.canUpdateComment(revokedAdminActor, "other_author")).toBe(false);
    });

    it("VERIFY: Actor of type 'admin' CAN perform moderator actions", () => {
        const adminActor = { type: "admin" as const, userId: "admin_1" };

        expect(CommentPolicy.canModerateComment(adminActor, false)).toBe(true);
        expect(CommentPolicy.canDeleteComment(adminActor, "other_author", false)).toBe(true);
        expect(CommentPolicy.canUpdateComment(adminActor, "other_author")).toBe(true);
    });
  });
});
