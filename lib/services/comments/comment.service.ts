import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { UserService } from '@/lib/services/user.service';
import { isAllowedAvatarUrl } from '@/lib/blob';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { publicCommentAuthorSelect } from '@/lib/comments-public-author';

export type CommentAuthor = {
  name?: string | null;
  username?: string | null;
};

export type ClerkAuthorProfile = {
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
};

export type SyncedLocalUser = {
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  language: string;
  role: 'ADMIN' | 'USER';
};

export class CommentService {
  static getCommentAuthorName(author?: CommentAuthor | null) {
    const rawName = author?.name?.trim();
    const name = rawName && !isGeneratedClerkUsername(rawName) ? rawName : null;
    const rawUsername = author?.username?.trim();
    const username = rawUsername && !isGeneratedClerkUsername(rawUsername) ? rawUsername : null;

    return name || username || "Użytkownik";
  }

  static cleanAuthorProfile(profile?: ClerkAuthorProfile | null) {
    const rawName = profile?.name?.trim() || null;
    const name = rawName && !isGeneratedClerkUsername(rawName) ? rawName : null;
    const rawUsername = profile?.username?.trim() || null;
    const username = rawUsername && !isGeneratedClerkUsername(rawUsername) ? rawUsername : null;
    const imageUrl = isAllowedAvatarUrl(profile?.imageUrl) ? profile?.imageUrl?.trim() || null : null;

    return { name, username, imageUrl };
  }

  static shouldReplaceStoredName(storedName: string | null | undefined, email: string | null | undefined, nextName: string | null) {
    if (!nextName) return false;

    const normalizedStoredName = storedName?.trim() || null;
    const emailLocalPart = email?.split('@')[0]?.trim() || null;

    return !normalizedStoredName
      || normalizedStoredName === 'Użytkownik'
      || isGeneratedClerkUsername(normalizedStoredName)
      || normalizedStoredName === emailLocalPart;
  }

  static async refreshLocalUserDisplayProfile<T extends SyncedLocalUser>(userId: string, localUser: T, profile?: ClerkAuthorProfile | null): Promise<T> {
    const cleanProfile = this.cleanAuthorProfile(profile);
    const shouldUpdateName = this.shouldReplaceStoredName(localUser.name, localUser.email, cleanProfile.name);
    const shouldUpdateImage = !!cleanProfile.imageUrl && cleanProfile.imageUrl !== localUser.imageUrl;
    const shouldUpdateUsername = !!cleanProfile.username && cleanProfile.username !== localUser.username;

    if (!shouldUpdateImage && !shouldUpdateName && !shouldUpdateUsername) {
      return localUser;
    }

    return await UserService.syncUser(
      userId,
      localUser.email,
      shouldUpdateName ? cleanProfile.name : localUser.name,
      shouldUpdateImage ? cleanProfile.imageUrl : localUser.imageUrl,
      undefined,
      localUser.language,
      shouldUpdateUsername ? cleanProfile.username : localUser.username,
      localUser.role
    ) as unknown as T;
  }

  static async getComments(videoId: string, sortBy: string, cursor?: string, limit: number = 20) {
    const orderBy: Prisma.CommentOrderByWithRelationInput[] = sortBy === 'top'
        ? [
            { pinnedAt: { sort: 'desc', nulls: 'last' } },
            { likes: { _count: 'desc' } },
            { createdAt: 'desc' }
          ]
        : [
            { pinnedAt: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' }
          ];

    return prisma.comment.findMany({
        where: { videoId, parentId: null },
        take: limit,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy,
        include: {
            author: { select: publicCommentAuthorSelect },
            replies: {
                take: 3,
                include: {
                    author: { select: publicCommentAuthorSelect },
                    _count: { select: { likes: true, dislikes: true } }
                },
                orderBy: { createdAt: 'asc' }
            },
            _count: {
                select: { likes: true, dislikes: true, replies: true }
            }
        }
    });
  }

  static async getInternalUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });
  }

  static async canModerate(userId: string, videoId: string) {
    const user = await this.getInternalUser(userId);
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const creator = await prisma.creator.findFirst({
        where: { userId, videos: { some: { id: videoId } } },
        select: { id: true }
    });
    return !!creator;
  }
}
