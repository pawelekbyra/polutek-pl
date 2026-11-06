import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommentStatus } from "@prisma/client";
import { mapCommentToDto, type CommentRow } from "@/lib/modules/comments/domain/comment.dto";
import { collectAuthorIds, loadVipAuthorIds } from "@/lib/modules/comments/application/comment-vip";
import { listVideoComments } from "@/lib/modules/comments/application/list-video-comments.use-case";
import { listCommentReplies } from "@/lib/modules/comments/application/list-comment-replies.use-case";
import { checkVideoAccess } from "@/lib/modules/access";
import { CommentRepository } from "@/lib/modules/comments/infrastructure/comment.repository";
import { ok } from "@/lib/modules/shared/result";
import { passKey } from "@/lib/modules/patron-zone/infrastructure/pass-store";
import { getAuthorBadge } from "@/app/components/comments/types";

vi.mock("@/lib/modules/access", () => ({ checkVideoAccess: vi.fn() }));
vi.mock("@/lib/modules/comments/infrastructure/comment.repository", () => ({ CommentRepository: vi.fn(function CommentRepositoryMock() {}) }));

const NOW = new Date("2026-11-02T12:00:00.000Z");
const DAY = 86_400_000;
const VIDEO_ID = "11111111-1111-4111-8111-111111111111";

const pass = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 3,
    provider: "STRIPE",
    ref: "pay_1",
    productId: "ACCESS_30D",
    priceMinor: 1499,
    totalMinor: 1499,
    currency: "PLN",
    method: "blik",
    paymentIds: ["pay_1"],
    lifetime: false,
    lifetimePaymentId: null,
    grantedAt: new Date(NOW.getTime() - DAY).toISOString(),
    expiresAt: new Date(NOW.getTime() + 29 * DAY).toISOString(),
    consents: { termsVersion: "t", waiverAt: NOW.toISOString() },
    ...overrides,
  });

const author = (id: string, overrides: Record<string, unknown> = {}) => ({ id, name: `Name ${id}`, username: null, imageUrl: null, isDeleted: false, role: "USER", ...overrides });

function row(id: string, authorId: string, extra: Record<string, unknown> = {}): CommentRow {
  return {
    id,
    videoId: VIDEO_ID,
    parentId: null,
    authorId,
    text: `text ${id}`,
    status: CommentStatus.VISIBLE,
    createdAt: NOW,
    updatedAt: NOW,
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    reportsCount: 0,
    isHearted: false,
    author: author(authorId),
    reactions: [],
    replies: [],
    ...extra,
  } as unknown as CommentRow;
}
const baseContext = { userId: null, canModerate: false, videoCreatorId: "creator-1", hasVideoAccess: true };

describe("comment DTO: VIP badge", () => {
  it("marks only the authors in the VIP set, with the bare badge 'VIP' and no other new field", () => {
    const vip = mapCommentToDto(row("c1", "vip-1"), { ...baseContext, vipAuthorIds: new Set(["vip-1"]) });
    const plain = mapCommentToDto(row("c2", "plain"), { ...baseContext, vipAuthorIds: new Set(["vip-1"]) });
    expect(vip.author?.badges).toEqual(["VIP"]);
    expect(plain.author?.badges).toEqual(["BASE"]);
    expect(Object.keys(vip.author!).sort()).toEqual(["badges", "displayName", "id", "imageUrl", "username"]);
    expect(JSON.stringify(vip)).not.toMatch(/expires|grantedAt|ACCESS_|priceMinor|premium|patron/i);
  });

  it("BASE ('Normik'): everyone with an account who is neither creator nor VIP; hierarchy creator > VIP > BASE", () => {
    const ctx = { ...baseContext, vipAuthorIds: new Set(["vip-1", "creator-1"]) };
    expect(mapCommentToDto(row("a", "plain"), ctx).author?.badges).toEqual(["BASE"]);
    expect(mapCommentToDto(row("b", "vip-1"), ctx).author?.badges).toEqual(["VIP"]);
    expect(mapCommentToDto(row("c", "creator-1"), ctx).author?.badges).toEqual(["AUTHOR", "VIP"]);
    expect(mapCommentToDto(row("d", "creator-1"), { ...baseContext, vipAuthorIds: new Set() }).author?.badges).toEqual(["AUTHOR"]);
    expect(getAuthorBadge({ id: "x", displayName: "x", username: null, imageUrl: null, badges: ["BASE"] })).toBe("BASE");
    expect(getAuthorBadge({ id: "x", displayName: "x", username: null, imageUrl: null, badges: ["VIP", "BASE"] })).toBe("VIP");
    expect(getAuthorBadge({ id: "x", displayName: "x", username: null, imageUrl: null, badges: ["AUTHOR", "VIP", "BASE"] })).toBe("AUTHOR");
  });

  it("no BASE without a VIP lookup (admin panel, failed lookup) and none for deleted accounts or hidden content", () => {
    expect(mapCommentToDto(row("a", "plain"), baseContext).author?.badges).toEqual([]);
    const set = new Set<string>();
    expect(mapCommentToDto(row("d", "gone", { author: author("gone", { isDeleted: true }) }), { ...baseContext, vipAuthorIds: set }).author?.badges).toEqual([]);
    expect(mapCommentToDto(row("h", "plain", { status: CommentStatus.HIDDEN }), { ...baseContext, vipAuthorIds: set }).author).toBeNull();
  });

  it("nobody is marked when the context carries no VIP set", () => {
    expect(mapCommentToDto(row("c1", "vip-1"), baseContext).author?.badges).toEqual([]);
  });

  it("the creator who is also VIP gets both flags in the DTO, and the UI shows only 'Twórca' (one pill, no growth)", () => {
    const dto = mapCommentToDto(row("c1", "creator-1", { author: author("creator-1", { role: "ADMIN" }) }), { ...baseContext, vipAuthorIds: new Set(["creator-1"]) });
    expect(dto.author?.badges).toEqual(["ADMIN", "AUTHOR", "VIP"]); // no BASE next to AUTHOR/VIP
    expect(getAuthorBadge(dto.author)).toBe("AUTHOR");
    expect(getAuthorBadge({ ...dto.author!, badges: ["VIP"] })).toBe("VIP");
    expect(getAuthorBadge({ ...dto.author!, badges: ["ADMIN"] })).toBeNull();
  });

  it("a deleted account is never marked, even if its id is in the set", () => {
    const dto = mapCommentToDto(row("c1", "gone", { author: author("gone", { isDeleted: true }) }), { ...baseContext, vipAuthorIds: new Set(["gone"]) });
    expect(dto.author?.badges).toEqual([]);
  });

  it("hidden content shows no author to the public, so no badge either", () => {
    const dto = mapCommentToDto(row("c1", "vip-1", { status: CommentStatus.HIDDEN }), { ...baseContext, vipAuthorIds: new Set(["vip-1"]) });
    expect(dto.author).toBeNull();
  });

  it("reply previews are marked too", () => {
    const dto = mapCommentToDto(row("p", "plain", { replies: [row("r", "vip-1", { parentId: "p" })] }), { ...baseContext, vipAuthorIds: new Set(["vip-1"]) });
    expect(dto.repliesPreview[0].author?.badges).toEqual(["VIP"]);
  });
});

describe("loadVipAuthorIds", () => {
  it("collects each author once, including reply previews, and skips deleted accounts", () => {
    const rows = [
      row("a", "u1", { replies: [row("b", "u2"), row("c", "u1")] }),
      row("d", "u3", { author: author("u3", { isDeleted: true }) }),
    ];
    expect(collectAuthorIds(rows as never).sort()).toEqual(["u1", "u2"]);
  });

  it("a failing lookup drops the badges but never breaks the comments", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const prisma = { appSetting: { findMany: vi.fn().mockRejectedValue(new Error("db down")) } };
    const result = await loadVipAuthorIds({ prisma: prisma as never, now: () => NOW }, [row("a", "u1")]);
    expect(result).toBeUndefined(); // unknown: so neither VIP nor BASE badges are shown
    warn.mockRestore();
  });
});

describe("comment list use cases: one batched lookup for the whole page (no N+1)", () => {
  const repo = { findVideoCreatorId: vi.fn(), findMany: vi.fn(), count: vi.fn(), findCommentById: vi.fn(), findReplies: vi.fn() };
  const findMany = vi.fn();
  const ctx = (actor: unknown) =>
    ({
      actor,
      now: () => NOW,
      prisma: { appSetting: { findMany }, video: { findUnique: vi.fn().mockResolvedValue({ commentsMode: "ON" }) } },
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CommentRepository).mockImplementation(function CommentRepositoryMock() {
      return repo as never;
    });
    vi.mocked(checkVideoAccess).mockResolvedValue(ok({ hasAccess: true, reason: "OK" } as never));
    repo.findVideoCreatorId.mockResolvedValue("creator-1");
    findMany.mockImplementation(async ({ where }: { where: { key: { in: string[] } } }) => {
      const table: Record<string, string> = {
        [passKey("vip-1")]: pass(),
        [passKey("expired-1")]: pass({ expiresAt: new Date(NOW.getTime() - DAY).toISOString() }),
        [passKey("life-1")]: pass({ productId: "ACCESS_LIFETIME", priceMinor: 2999, expiresAt: new Date(NOW.getTime() + 89 * DAY).toISOString() }), // the 3-month plan
      };
      return where.key.in.filter((key) => key in table).map((key) => ({ key, value: table[key] }));
    });
  });

  it("listVideoComments: 24 comments by 23 authors (with a reply) cost exactly one VIP query, an expired access gets no badge", async () => {
    const authors = Array.from({ length: 20 }, (_, i) => `user-${i}`).concat(["vip-1", "expired-1", "life-1"]);
    const rows = authors.map((authorId, i) => row(`c${i}`, authorId));
    rows.push(row("c-with-replies", "user-0", { replies: [row("rr", "vip-1", { parentId: "c-with-replies" })] }));
    repo.findMany.mockResolvedValue(rows);
    repo.count.mockResolvedValue(rows.length);

    const result = await listVideoComments({ videoId: VIDEO_ID, sortBy: "newest", limit: 50 }, ctx({ type: "guest" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findMany).toHaveBeenCalledTimes(1);
    const byId = Object.fromEntries(result.data.comments.map((c) => [c.id, c.author?.badges]));
    expect(byId["c20"]).toEqual(["VIP"]);
    expect(byId["c21"]).toEqual(["BASE"]);
    expect(byId["c22"]).toEqual(["VIP"]);
    expect(byId["c0"]).toEqual(["BASE"]);
    expect(result.data.comments.find((c) => c.id === "c-with-replies")?.repliesPreview[0].author?.badges).toEqual(["VIP"]);
    expect(JSON.stringify(result.data)).not.toMatch(/ACCESS_|expiresAt|grantedAt|priceMinor/);
  });

  it("listCommentReplies: a page of replies costs one VIP query", async () => {
    repo.findCommentById.mockResolvedValue({ id: "p", videoId: VIDEO_ID, status: CommentStatus.VISIBLE, deletedReason: null, author: { isDeleted: false } });
    repo.findReplies.mockResolvedValue([row("r1", "vip-1"), row("r2", "user-2"), row("r3", "life-1"), row("r4", "user-4")]);

    const result = await listCommentReplies({ commentId: "p", limit: 10 }, ctx({ type: "guest" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(result.data.replies.map((r) => r.author?.badges)).toEqual([["VIP"], ["BASE"], ["VIP"], ["BASE"]]);
  });
});
