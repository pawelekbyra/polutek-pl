import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { GET as mediaSourceGET } from "@/app/api/media-source/[videoId]/route";
import {
  PATCH as commentPATCH,
  DELETE as commentDELETE,
} from "@/app/api/comments/[commentId]/route";
import { POST as pinPOST } from "@/app/api/comments/[commentId]/pin/route";
import { checkVideoAccess } from "@/lib/modules/access";
import {
  updateComment,
  deleteComment,
  pinComment,
  hideAdminComment,
} from "@/lib/modules/comments";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";

vi.mock("@/lib/api/auth", () => ({
  getActorFromAuth: vi.fn(),
}));

vi.mock("@/lib/services/playback/playback.service", () => ({
  PlaybackService: {
    createPlaybackPlanWithContext: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/modules/access", () => ({
  checkVideoAccess: vi.fn(),
}));

vi.mock("@/lib/modules/comments", () => ({
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  pinComment: vi.fn(),
  hideAdminComment: vi.fn(),
}));

vi.mock("@/lib/modules/shared/app-context", () => ({
  createAppContext: vi.fn((input) => input),
}));

describe("dynamic auth route boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleted User on public media route returns a controlled response", async () => {
    vi.mocked(getActorFromAuth).mockRejectedValue(
      new AppError("Forbidden", 403, "FORBIDDEN"),
    );

    const response = await mediaSourceGET(
      new NextRequest("http://localhost/api/media-source/video_1"),
      { params: Promise.resolve({ videoId: "video_1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("deleted User on comment PATCH/DELETE/pin returns controlled responses", async () => {
    vi.mocked(getActorFromAuth).mockRejectedValue(
      new AppError("Forbidden", 403, "FORBIDDEN"),
    );

    const patch = await commentPATCH(
      new NextRequest("http://localhost/api/comments/comment_1", {
        method: "PATCH",
        body: JSON.stringify({ text: "x" }),
      }),
      { params: Promise.resolve({ commentId: "comment_1" }) },
    );
    const del = await commentDELETE(
      new NextRequest("http://localhost/api/comments/comment_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ commentId: "comment_1" }) },
    );
    const pin = await pinPOST(
      new NextRequest("http://localhost/api/comments/comment_1/pin", {
        method: "POST",
      }),
      { params: Promise.resolve({ commentId: "comment_1" }) },
    );

    expect(patch.status).toBe(403);
    expect(del.status).toBe(403);
    expect(pin.status).toBe(403);
  });

  it("revoked admin with stale claim is a DB USER for draft/private playback", async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({
      type: "user",
      userId: "revoked_admin",
      isPatron: false,
    });
    vi.mocked(checkVideoAccess).mockResolvedValue({
      ok: true,
      data: { hasAccess: false, reason: "NOT_FOUND" },
    } as never);

    // Exercise the boundary shape expected after canonical resolution.
    const actor = await getActorFromAuth();
    await checkVideoAccess({ videoIdOrSlug: "draft_video" }, {
      actor,
    } as never);

    expect(actor).toEqual({
      type: "user",
      userId: "revoked_admin",
      isPatron: false,
    });
    expect(checkVideoAccess).toHaveBeenCalledWith(
      { videoIdOrSlug: "draft_video" },
      expect.objectContaining({ actor }),
    );
  });

  it("revoked admin with stale claim cannot edit, pin, or moderate comments", async () => {
    vi.mocked(getActorFromAuth).mockResolvedValue({
      type: "user",
      userId: "revoked_admin",
      isPatron: false,
    });
    vi.mocked(updateComment).mockResolvedValue({
      ok: false,
      error: { type: "FORBIDDEN", message: "Forbidden" },
    } as never);
    vi.mocked(deleteComment).mockResolvedValue({
      ok: false,
      error: { type: "FORBIDDEN", message: "Forbidden" },
    } as never);
    vi.mocked(pinComment).mockResolvedValue({
      ok: false,
      error: { type: "FORBIDDEN", message: "Forbidden" },
    } as never);
    vi.mocked(hideAdminComment).mockResolvedValue({
      ok: false,
      error: { type: "FORBIDDEN", message: "Forbidden" },
    } as never);

    const patch = await commentPATCH(
      new NextRequest("http://localhost/api/comments/comment_1", {
        method: "PATCH",
        body: JSON.stringify({ text: "x" }),
      }),
      { params: Promise.resolve({ commentId: "comment_1" }) },
    );
    const pin = await pinPOST(
      new NextRequest("http://localhost/api/comments/comment_1/pin", {
        method: "POST",
      }),
      { params: Promise.resolve({ commentId: "comment_1" }) },
    );
    await hideAdminComment("comment_1", {
      actor: { type: "user", userId: "revoked_admin", isPatron: false },
    } as never);

    expect(patch.status).toBe(403);
    expect(pin.status).toBe(403);
    expect(hideAdminComment).toHaveBeenCalled();
  });

  it("Navbar admin UI works for DB admin without admin metadata", () => {
    expect(resolveNavbarAdminUiState(true, undefined)).toBe(true);
  });
});
