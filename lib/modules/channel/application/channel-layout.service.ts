import { prisma } from '@/lib/prisma';
import { VideoStatus } from '@prisma/client';
import { toVideoAccessTier, type VideoAccessTier } from '@/lib/access-tier';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { compareSidebarItems } from '@/lib/modules/video';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { resolvePublicThumbnailSrc } from '@/lib/modules/media';
// Deep import allowlisted in scripts/check-architecture.ts (pure helper).
import { effectivePublishedAt, isUpcomingPremiere, toPremiereDate } from '@/lib/modules/video/domain/premiere';

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
    creator?: {
        id: string;
        name: string;
        slug: string;
    };
};

export type SidebarSection = {
    id: string;
    // UPCOMING = scheduled premieres not reached yet (CLAUDE.md "Premieres").
    type: "FREE" | "LOGGED_IN" | "UPCOMING" | "ANNOUNCEMENT";
    title: string;
    items: SidebarItem[];
};

export class ChannelLayoutService {
    /**
     * `viewer.isStaff` comes from the resolved Actor (`actor.type === "admin"`, lib/api/auth), never from reading
     * `User.role` here (stage 8): it only lifts the cosmetic lock flags, playback is still decided by checkVideoAccess.
     */
    static async getSidebarLayout(userId: string | null, currentVideoId?: string, viewer: { isStaff?: boolean } = {}) {
        let viewerState: SidebarViewerState = "ANONYMOUS";

        if (userId) {
            viewerState = viewer.isStaff ? "ADMIN" : "LOGGED_IN";
        }

        const mainChannel = await MainChannelService.getRequired(createAppContext()).catch(() => null);
        if (!mainChannel) {
            return { viewerState, sections: [], currentVideoId };
        }

        const now = new Date();
        const videos = await prisma.video.findMany({
            where: {
                creatorId: mainChannel.id,
                status: VideoStatus.PUBLISHED,
                showInSidebar: true,
                OR: [
                    { publishedAt: null },
                    { publishedAt: { lte: now } },
                ],
            },
            include: { creator: true }
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
            isLocked: isUpcomingPremiere(v, now) ? viewerState !== "ADMIN" : this.isLocked(v.tier, viewerState),
            creator: v.creator ? {
                id: v.creator.id,
                name: v.creator.name,
                slug: v.creator.slug
            } : undefined
        });

        if (freeVideos.length > 0) {
            sections.push({
                id: 'section-free',
                type: 'FREE',
                title: 'Publiczne',
                items: freeVideos.map(mapItem)
            });
        }

        if (loggedInVideos.length > 0) {
            sections.push({
                id: 'section-logged-in',
                type: 'LOGGED_IN',
                title: 'Dla zalogowanych',
                items: loggedInVideos.map(mapItem)
            });
        }

        if (upcomingVideos.length > 0) {
            sections.push({
                id: 'section-upcoming',
                type: 'UPCOMING',
                title: 'Już wkrótce',
                items: upcomingVideos.map(mapItem)
            });
        }

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
