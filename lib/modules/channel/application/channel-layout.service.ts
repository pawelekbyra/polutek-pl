import { prisma } from '@/lib/prisma';
import { AccessTier, VideoStatus } from '@prisma/client';
import { MainChannelService } from '@/lib/modules/channel/application/main-channel.service';
import { compareSidebarItems } from '@/lib/modules/video';

export type SidebarViewerState = "ANONYMOUS" | "LOGGED_IN" | "PATRON" | "ADMIN";

export type SidebarItem = {
    id: string;
    slug: string;
    title: string;
    titleEn?: string | null;
    thumbnailUrl: string;
    tier: AccessTier;
    status: VideoStatus;
    duration?: string | null;
    views: number;
    publishedAt: Date | null;
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
    type: "FREE" | "LOGGED_IN" | "PATRON" | "ANNOUNCEMENT";
    title: string;
    items: SidebarItem[];
};

export class ChannelLayoutService {
    static async getSidebarLayout(userId: string | null, currentVideoId?: string) {
        let viewerState: SidebarViewerState = "ANONYMOUS";

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    role: true,
                    patronGrants: {
                        where: { revokedAt: null },
                        select: { id: true },
                        take: 1,
                    },
                },
            });
            if (user?.role === 'ADMIN') viewerState = "ADMIN";
            else if ((user?.patronGrants?.length ?? 0) > 0) viewerState = "PATRON";
            else viewerState = "LOGGED_IN";
        }

        const mainChannel = await MainChannelService.getPublicRequired().catch(() => null);
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

        const sortedVideos = [...videos].sort(compareSidebarItems);

        const sections: SidebarSection[] = [];

        const freeVideos = sortedVideos.filter(v => v.tier === AccessTier.PUBLIC);
        const loggedInVideos = sortedVideos.filter(v => v.tier === AccessTier.LOGGED_IN);
        const patronVideos = sortedVideos.filter(v => v.tier === AccessTier.PATRON);

        const mapItem = (v: any): SidebarItem => ({
            id: v.id,
            slug: v.slug,
            title: v.title,
            titleEn: v.titleEn,
            thumbnailUrl: `/api/videos/${v.id}/thumbnail`,
            tier: v.tier,
            status: v.status,
            duration: v.duration,
            views: v.views,
            publishedAt: v.publishedAt,
            createdAt: v.createdAt,
            sidebarOrder: v.sidebarOrder,
            creatorId: v.creatorId,
            isLocked: this.isLocked(v.tier, viewerState),
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

        if (patronVideos.length > 0) {
            sections.push({
                id: 'section-patron',
                type: 'PATRON',
                title: 'Strefa Fenkju',
                items: patronVideos.map(mapItem)
            });
        }

        return {
            viewerState,
            sections,
            currentVideoId
        };
    }

    private static isLocked(tier: AccessTier, state: SidebarViewerState): boolean {
        if (state === "ADMIN") return false;
        if (tier === AccessTier.PUBLIC) return false;
        if (tier === AccessTier.LOGGED_IN) return state === "ANONYMOUS";
        if (tier === AccessTier.PATRON) return state !== "PATRON";
        return true;
    }
}