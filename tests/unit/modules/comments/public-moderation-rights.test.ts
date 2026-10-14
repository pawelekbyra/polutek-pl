import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "@/lib/modules/comments/application/authorize-comments";
import { mapCommentToDto } from "@/lib/modules/comments/domain/comment.dto";
import { CommentStatus } from "@prisma/client";

function ctxFor(actor: unknown, members: { userId: string; role: string }[] = []) {
  const prisma = {
    video: { findUnique: vi.fn(async () => ({ creator: { id: "ch1", userId: "owner", status: "ACTIVE", members } })) },
  };
  return createAppContext({ actor: actor as never, prisma: prisma as never });
}

describe("who moderates comments on the public site", () => {
  it("the channel owner and a channel moderator do", async () => {
    expect(await canModerateVideoComments(ctxFor({ type: "user", userId: "owner" }), "v1")).toBe(true);
    expect(await canModerateVideoComments(ctxFor({ type: "user", userId: "m1" }, [{ userId: "m1", role: "MODERATOR" }]), "v1")).toBe(true);
  });

  it("an ordinary signed-in viewer does not", async () => {
    expect(await canModerateVideoComments(ctxFor({ type: "user", userId: "someone" }), "v1")).toBe(false);
  });

  it("platform staff and guests do not (staff moderate in the admin panel)", async () => {
    expect(await canModerateVideoComments(ctxFor({ type: "admin", userId: "a1" }), "v1")).toBe(false);
    expect(await canModerateVideoComments(ctxFor({ type: "guest" }), "v1")).toBe(false);
  });

  it("an ordinary viewer's DTO offers edit/delete on the own comment only, and report on the others", () => {
    const base = {
      id: "c1", videoId: "v1", parentId: null, authorId: "me", text: "x", status: CommentStatus.VISIBLE,
      createdAt: new Date(), updatedAt: new Date(), editedAt: null, deletedAt: null, deletedReason: null, pinnedAt: null,
      likesCount: 0, reportsCount: 0, isHearted: false, author: { id: "me", name: "Me", username: null, imageUrl: null, isDeleted: false, role: "USER", patronGrants: [] },
    } as never;
    const ctx = { userId: "me", canModerate: false, videoCreatorId: "owner", hasVideoAccess: true };
    const own = mapCommentToDto(base, ctx);
    expect(own).toMatchObject({ viewerCanEdit: true, viewerCanDelete: true, viewerCanReport: false, viewerCanPin: false, viewerCanModerate: false });
    const others = mapCommentToDto({ ...(base as object), authorId: "other" } as never, ctx);
    expect(others).toMatchObject({ viewerCanEdit: false, viewerCanDelete: false, viewerCanReport: true, viewerCanPin: false, viewerCanModerate: false });
  });
});
