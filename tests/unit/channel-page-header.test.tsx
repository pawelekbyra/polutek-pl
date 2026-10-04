import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { getCreatorBySlug, creatorFindUnique } = vi.hoisted(() => ({
  getCreatorBySlug: vi.fn(),
  creatorFindUnique: vi.fn(),
}));

vi.mock("@/app/components/Navbar", () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock("@/app/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/app/components/SubscribeButton", () => ({ default: () => <button type="button">Subscribe</button> }));
vi.mock("@/app/components/ChannelVideoCard", () => ({
  default: ({ video }: { video: { title: string } }) => <article>{video.title}</article>,
}));
vi.mock("@/app/components/SafeAvatar", () => ({
  SafeAvatar: ({ src, alt, size }: { src?: string | null; alt: string; size: number }) => (
    <span data-avatar={src ?? "/default-avatar.jpg"} data-size={size} aria-label={alt} />
  ),
}));
vi.mock("@/lib/auth/server", () => ({ auth: vi.fn().mockResolvedValue({ userId: null }) }));
vi.mock("@/lib/modules/users", () => ({ getOrCreateCurrentUser: vi.fn() }));
vi.mock("@/lib/channel/main-channel.service", () => ({
  MainChannelService: { getConfiguredSlug: () => "polutek" },
}));
vi.mock("@/lib/modules/channel/infrastructure/creator-content.service", () => ({
  CreatorContentService: { getCreatorBySlug },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    creator: { findUnique: creatorFindUnique },
    subscription: { findUnique: vi.fn() },
  },
}));

import ChannelPage from "@/app/[locale]/channel/[slug]/page";

async function render(locale: "pl" | "en" = "pl") {
  const element = await ChannelPage({ params: Promise.resolve({ locale, slug: "polutek" }) });
  return renderToStaticMarkup(element);
}

describe("/[locale]/channel/[slug] header", () => {
  beforeEach(() => {
    creatorFindUnique.mockResolvedValue({ subscribersCount: 7, displaySubscribersCount: null });
    getCreatorBySlug.mockResolvedValue({
      id: "creator-1",
      name: "Paweł Perfect",
      slug: "polutek",
      imageUrl: "/api/avatars/u1?v=1",
      bio: "Opis kanału",
      // A legacy cover value still sitting in the database must not reach the page.
      bannerUrl: "https://example.com/old-cover.jpg",
      subscribersCount: 7,
      videos: [],
    });
  });

  it("renders the profile card as the whole header, without a cover photo", async () => {
    const html = await render();

    expect(html).not.toContain("old-cover.jpg");
    expect(html).not.toContain("channel-hero-banner");
    expect(html).not.toContain("aspect-[6/1]");

    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header).toContain('class="channel-profile');
    expect(header).toContain("Paweł Perfect");
    expect(header).toContain("@polutek");
    expect(header).toContain("0 filmów");
    expect(header).toContain("Opis kanału");
    expect(header).toContain("Subscribe");
    expect(header).toContain("/api/avatars/u1?v=1");
    // Nothing but the navbar sits between the top of the page and the header.
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("channel-tabs"));
  });

  it("labels the video count in English on the English page", async () => {
    getCreatorBySlug.mockResolvedValueOnce({
      id: "creator-1",
      name: "Paweł Perfect",
      slug: "polutek",
      imageUrl: null,
      bio: null,
      subscribersCount: 7,
      videos: [{ id: "v1", title: "Film 1", creatorId: "creator-1" }],
    });

    const html = await render("en");

    expect(html).toContain("1 video");
    expect(html).toContain("Welcome to the official channel.");
  });
});
