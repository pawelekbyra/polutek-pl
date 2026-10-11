import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The channel avatar must be the same picture on the home page (video list, featured video) and on
// the channel page (the creator's video list), and must never be the logged-in viewer's own image,
// not even when the viewer is the administrator (CLAUDE.md §4.5, owner report 2026-10-11).

const OWNER_AVATAR = "/api/avatars/channel-owner?v=3";
const ADMIN_AVATAR = "/api/avatars/first-admin?v=9";
const VIEWER_AVATAR = "/api/avatars/logged-in-viewer?v=7";

const { creatorFindUnique, videoFindMany, videoFindFirst, userFindFirst, authMock, currentUserMock } = vi.hoisted(() => ({
  creatorFindUnique: vi.fn(),
  videoFindMany: vi.fn(),
  videoFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  authMock: vi.fn(),
  currentUserMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creator: { findUnique: creatorFindUnique },
    video: { findMany: videoFindMany, findFirst: videoFindFirst },
    user: { findFirst: userFindFirst },
    subscription: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/app/components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("@/app/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/app/components/SubscribeButton", () => ({ default: () => <button type="button">Subscribe</button> }));
vi.mock("@/app/components/ChannelVideoCard", () => ({
  default: ({ video }: { video: { title: string; creator?: { imageUrl?: string | null } } }) => (
    <article data-card-avatar={video.creator?.imageUrl ?? ""}>{video.title}</article>
  ),
}));
vi.mock("@/app/components/SafeAvatar", () => ({
  SafeAvatar: ({ src }: { src?: string | null }) => <span data-avatar={src ?? ""} />,
}));
vi.mock("@/lib/auth/server", () => ({ auth: authMock }));
vi.mock("@/lib/modules/users", () => ({ getOrCreateCurrentUser: currentUserMock }));

import ChannelPage from "@/app/[locale]/channel/[slug]/page";
import { CreatorContentService } from "@/lib/modules/channel/infrastructure/creator-content.service";
import { resolveChannelAvatarUrl } from "@/lib/modules/channel";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";

function video(id: string) {
  return {
    id,
    creatorId: "creator-1",
    title: `Film ${id}`,
    slug: `film-${id}`,
    tier: "PUBLIC",
    status: "PUBLISHED",
    views: 0,
    likesCount: 0,
    dislikesCount: 0,
    isMainFeatured: id === "v1",
    sidebarOrder: 0,
    showInSidebar: true,
    publishedAt: new Date("2026-01-01"),
    premiereAt: null,
  };
}

function creatorRow(ownerImageUrl: string | null) {
  return {
    id: "creator-1",
    userId: "owner-user",
    slug: "polutek",
    name: "Paweł Perfect",
    bio: "Opis",
    subscribersCount: 5,
    displaySubscribersCount: null,
    isApproved: true,
    isPrimary: true,
    user: { imageUrl: ownerImageUrl, email: "owner@example.com" },
    videos: [video("v1"), video("v2")],
  };
}

function seed(ownerImageUrl: string | null, adminImageUrl: string | null) {
  const row = creatorRow(ownerImageUrl);
  creatorFindUnique.mockResolvedValue(row);
  videoFindMany.mockResolvedValue(row.videos.map((v) => ({ ...v, creator: { ...row, videos: undefined } })));
  videoFindFirst.mockResolvedValue({ ...row.videos[0], creator: { ...row, videos: undefined } });
  userFindFirst.mockResolvedValue(adminImageUrl === null ? null : { imageUrl: adminImageUrl });
}

async function homeAvatars() {
  const all = await VideoContentService.getAllVideos();
  const featured = await VideoContentService.getMainFeaturedVideo();
  return {
    list: all.map((v) => v.creator?.imageUrl ?? null),
    featured: featured?.creator?.imageUrl ?? null,
  };
}

async function renderChannelPage() {
  const element = await ChannelPage({ params: Promise.resolve({ locale: "pl", slug: "polutek" }) });
  return renderToStaticMarkup(element);
}

function headerAvatars(html: string) {
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  return [...header.matchAll(/data-avatar="([^"]*)"/g)].map((m) => m[1]);
}

describe("resolveChannelAvatarUrl", () => {
  it("prefers the channel owner's avatar, then the first administrator's, then null", () => {
    expect(resolveChannelAvatarUrl({ ownerImageUrl: OWNER_AVATAR, adminImageUrl: ADMIN_AVATAR })).toBe(OWNER_AVATAR);
    expect(resolveChannelAvatarUrl({ ownerImageUrl: null, adminImageUrl: ADMIN_AVATAR })).toBe(ADMIN_AVATAR);
    expect(resolveChannelAvatarUrl({ ownerImageUrl: "", adminImageUrl: null })).toBeNull();
    expect(resolveChannelAvatarUrl({})).toBeNull();
  });
});

describe("channel avatar source (home page vs channel page)", () => {
  const saved = process.env.MAIN_CREATOR_SLUG;

  beforeEach(() => {
    process.env.MAIN_CREATOR_SLUG = "polutek";
    // An administrator is looking at the page: the viewer's own profile image is different from both
    // the channel owner's and the first administrator's.
    authMock.mockResolvedValue({ userId: "viewer-admin" });
    currentUserMock.mockResolvedValue({ id: "viewer-admin", role: "ADMIN", imageUrl: VIEWER_AVATAR });
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.MAIN_CREATOR_SLUG;
    else process.env.MAIN_CREATOR_SLUG = saved;
    vi.clearAllMocks();
  });

  it("shows the channel owner's avatar on both pages, never the logged-in admin's profile image", async () => {
    seed(OWNER_AVATAR, ADMIN_AVATAR);

    const home = await homeAvatars();
    expect(home.featured).toBe(OWNER_AVATAR);
    expect(home.list).toEqual([OWNER_AVATAR, OWNER_AVATAR]);

    const creator = await CreatorContentService.getCreatorBySlug("polutek");
    expect(creator?.imageUrl).toBe(OWNER_AVATAR);
    expect(creator?.videos.map((v) => v.creator?.imageUrl)).toEqual([OWNER_AVATAR, OWNER_AVATAR]);

    const html = await renderChannelPage();
    expect(headerAvatars(html)).toEqual([OWNER_AVATAR, OWNER_AVATAR]);
    expect(html).not.toContain(VIEWER_AVATAR);
    expect(html).not.toContain(ADMIN_AVATAR);
    // The card under the header gets the same channel picture as the home page's list.
    expect(html).toContain(`data-card-avatar="${home.list[0]}"`);
  });

  it("falls back to the first administrator's avatar identically on both pages when the owner has none", async () => {
    seed(null, ADMIN_AVATAR);

    const home = await homeAvatars();
    expect(home.featured).toBe(ADMIN_AVATAR);
    expect(home.list).toEqual([ADMIN_AVATAR, ADMIN_AVATAR]);

    const html = await renderChannelPage();
    expect(headerAvatars(html)).toEqual([ADMIN_AVATAR, ADMIN_AVATAR]);
    expect(html).not.toContain(VIEWER_AVATAR);
  });

  it("does not use the viewer's image when the channel has no avatar at all", async () => {
    seed(null, null);

    const home = await homeAvatars();
    expect(home.featured).toBeNull();

    const html = await renderChannelPage();
    expect(headerAvatars(html)).toEqual(["", ""]);
    expect(html).not.toContain(VIEWER_AVATAR);
  });
});
