import { prisma } from '@/lib/prisma';

export async function getVideoInteraction(userId: string, videoId: string) {
    const [like, dislike] = await Promise.all([
        prisma.videoLike.findUnique({ where: { userId_videoId: { userId, videoId } } }).catch(() => null),
        prisma.videoDislike.findUnique({ where: { userId_videoId: { userId, videoId } } }).catch(() => null)
    ]);
    return { liked: !!like, disliked: !!dislike };
}
