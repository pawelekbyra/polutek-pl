import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { toVideoAccessTier, type VideoAccessTier } from '@/lib/access-tier';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { compareSidebarItems } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { resolvePublicThumbnailSrc } from '@/lib/modules/media';
// Deep import allowlisted in scripts/check-architecture.ts (pure helper).
import { effectivePublishedAt, isUpcomingPremiere, toPremiereDate } from '@/lib/modules/video/domain/premiere';
import { premiumPassViewerFacts } from '@/lib/modules/patron-zone'; // patron zone (docs/architecture/patron-zone.md)

// Whether someone tipped never reaches public data (owner decision 2026-10-04): no PATRON state.
export type SidebarViewerState = "ANONYMOUS" | "LOGGED_IN" | "ADMIN";

export type SidebarItem = {
    id: string;
    slug: string;
    title: string;
    titleEn?: string | null;
    thumbnailUrl: string;
    tier: VideoAccessTier;
    status: VideoStatus;
    duration?: string | null;
    views: number;
    /** Viewer-facing publish date (the premiere time once one is scheduled). */
    publishedAt: Date | null;
    /** ISO time of a scheduled premiere, or null. */
    premiereAt: string | null;
    createdAt?: Date | null;
    sidebarOrder?: number | null;
    creatorId: string;
    isLocked: boolean;
    /** patron zone: behind the demo pass for this viewer (locked unless the viewer holds an active pass). */
    premium?: true;
    creator?: {
        id: string;
        name: string;
        slug: string;
    };
};

export type SidebarSectionType = "FREE" | "LOGGED_IN" | "UPCOMING" | "ANNOUNCEMENT";

export type SidebarSection = {
    id: string;
    // UPCOMING = scheduled premieres not reached yet (CLAUDE.md "Premieres").
    type: SidebarSectionType;
    title: string;
    items: SidebarItem[];
    /** How many videos the whole section has (items is only the requested window of it). */
    total: number;
};

/** Videos of one section the sidebar shows at first and per "More" request (W03). */
export const SIDEBAR_PAGE_SIZE = 24;
export const SIDEBAR_PAGE_SIZE_MAX = 60;

export type SidebarPageOptions = {
    /** Only this section, from `offset` (the "More" request); without it every section from its start. */
    section?: SidebarSectionType;
    offset?: number;
    limit?: number;
};

export class ChannelLayoutService {
    /**
     * `viewer.isStaff` comes from the resolved Actor (`actor.type === "admin"`, lib/api/auth), never from reading
     * `User.role` here (stage 8): it only lifts the cosmetic lock flags, playback is still decided by checkVideoAccess.
     */
    static async getSidebarLayout(
        userId: string | null,
        currentVideoId?: string,
        viewer: { isStaff?: boolean } = {},
        page: SidebarPageOptions = {},
    ) {
        const limit = Math.min(Math.max(Math.floor(page.limit ?? SIDEBAR_PAGE_SIZE), 1), SIDEBAR_PAGE_SIZE_MAX);
        const offset = page.section ? Math.max(Math.floor(page.offset ?? 0), 0) : 0;
        let viewerState: SidebarViewerState = "ANONYMOUS";

        if (userId) {
            viewerState = viewer.isStaff ? "ADMIN" : "LOGGED_IN";
        }

        const mainChannel = await MainChannelService.getRequired(createAppContext()).catch(() => null);
        if (!mainChannel) {
            return { viewerState, sections: [], currentVideoId };
        }

        const now = new Date();
        // patron zone: one AppSetting read per layout, only while the patron zone is visible to this viewer.
        const pass = await premiumPassViewerFacts(createAppContext({ actor: userId ? (viewer.isStaff ? { type: 'admin', userId } : { type: 'user', userId }) : { type: 'guest' } }), now);
        const videos = await prisma.video.findMany({
            where: {
                creatorId: mainChannel.id,
                status: VideoStatus.PUBLISHED,
                moderationStatus: { not: 'REMOVED' },
                showInSidebar: true,
                OR: [
                    { publishedAt: null },
                    { publishedAt: { lte: now } },
                ],
            },
            // Only what the sidebar item, its sort and the lock/premium decisions read (W03): no descriptions, chapters,
            // search text or the full channel row for every video of the list.
            select: {
                id: true,
                slug: true,
                title: true,
                titleEn: true,
                thumbnailUrl: true,
                thumbnailPublicUrl: true,
                tier: true,
                status: true,
                duration: true,
                views: true,
                publishedAt: true,
                premiereAt: true,
                createdAt: true,
                sidebarOrder: true,
                creatorId: true,
                isMainFeatured: true,
                creator: { select: { id: true, name: true, slug: true } },
            },
        });

        // Sort on the viewer-facing publish date so a premiered video ranks
        // from its premiere, not from when the admin scheduled it.
        const sortedVideos = videos
            .map(v => ({ ...v, publishedAt: effectivePublishedAt(v) }))
            .sort(compareSidebarItems);

        const sections: SidebarSection[] = [];

        // Upcoming premieres get their own section (soonest first) and never
        // also appear in their tier's section; once premiereAt passes they are
        // ordinary videos again — evaluated per request, no cron.
        const upcomingVideos = sortedVideos
            .filter(v => isUpcomingPremiere(v, now))
            .sort((a, b) => toPremiereDate(a.premiereAt)!.getTime() - toPremiereDate(b.premiereAt)!.getTime());
        const releasedVideos = sortedVideos.filter(v => !isUpcomingPremiere(v, now));

        // Two levels (lib/access-tier.ts).
        const freeVideos = releasedVideos.filter(v => toVideoAccessTier(v.tier) === "PUBLIC");
        const loggedInVideos = releasedVideos.filter(v => toVideoAccessTier(v.tier) === "LOGGED_IN");

        const mapItem = (v: any): SidebarItem => ({
            id: v.id,
            slug: v.slug,
            title: v.title,
            titleEn: v.titleEn,
            thumbnailUrl: resolvePublicThumbnailSrc(v, process.env),
            tier: toVideoAccessTier(v.tier),
            status: v.status,
            duration: v.duration,
            views: v.views,
            publishedAt: v.publishedAt,
            premiereAt: toPremiereDate(v.premiereAt)?.toISOString() ?? null,
            createdAt: v.createdAt,
            sidebarOrder: v.sidebarOrder,
            creatorId: v.creatorId,
            // An upcoming premiere is never playable before its time, for anyone.
            isLocked: isUpcomingPremiere(v, now) ? viewerState !== "ADMIN" : pass?.isPremium(v) ? !pass.hasActivePass : this.isLocked(v.tier, viewerState),
            ...(pass?.isPremium(v) ? { premium: true as const } : {}),
            creator: v.creator ? {
                id: v.creator.id,
                name: v.creator.name,
                slug: v.creator.slug
            } : undefined
        });

        // Each section keeps its full order; only the window of it that is sent is cut (W03): the first page of every
        // section, or, for a "More" request, the next page of the one section asked for.
        const addSection = (id: string, type: SidebarSectionType, title: string, all: typeof sortedVideos) => {
            if (all.length === 0 || (page.section && page.section !== type)) return;
            sections.push({
                id,
                type,
                title,
                items: all.slice(offset, offset + limit).map(mapItem),
                total: all.length,
            });
        };

        addSection('section-free', 'FREE', 'Publiczne', freeVideos);
        addSection('section-logged-in', 'LOGGED_IN', 'Dla zalogowanych', loggedInVideos);
        addSection('section-upcoming', 'UPCOMING', 'Już wkrótce', upcomingVideos);

        return {
            viewerState,
            sections,
            currentVideoId
        };
    }

    private static isLocked(tier: unknown, state: SidebarViewerState): boolean {
        if (state === "ADMIN") return false;
        return toVideoAccessTier(tier) === "LOGGED_IN" && state === "ANONYMOUS";
    }
}
