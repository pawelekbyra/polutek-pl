import { Prisma, type Creator } from '@prisma/client';
import { MAIN_CREATOR_NAME, MAIN_CREATOR_SLUG } from '@/lib/constants';
import { flags } from '@/lib/feature-flags';
import { prisma } from '@/lib/prisma';

const MAIN_CREATOR_SLUG_PATTERN = /^[a-z0-9-]+$/;

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

type EnsureOptions = {
  /**
   * In single-channel admin flows, legacy data may have videos attached to an
   * older creator/slug. Enable this to make the configured main creator own the
   * complete admin video library again.
   */
  repairSingleChannelContent?: boolean;
};

export class MainCreatorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainCreatorConfigurationError';
  }
}

function getConfiguredMainCreatorSlug() {
  return (flags.mainCreatorSlug || MAIN_CREATOR_SLUG).trim();
}

function requireValidMainCreatorSlug() {
  const slug = getConfiguredMainCreatorSlug();

  if (!slug) {
    throw new MainCreatorConfigurationError('MAIN_CREATOR_SLUG is required for the single-channel admin flow.');
  }

  if (!MAIN_CREATOR_SLUG_PATTERN.test(slug)) {
    throw new MainCreatorConfigurationError('MAIN_CREATOR_SLUG must contain only lowercase letters, numbers and dashes.');
  }

  return slug;
}

async function findBestExistingMainCreatorCandidate(db: PrismaExecutor) {
  return db.creator.findFirst({
    orderBy: [
      { isPrimary: 'desc' },
      { isApproved: 'desc' },
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

async function markAsOnlyPrimary(db: PrismaExecutor, creator: Creator) {
  const [updatedCreator] = await Promise.all([
    db.creator.update({
      where: { id: creator.id },
      data: {
        isApproved: true,
        isPrimary: true,
      },
    }),
    db.creator.updateMany({
      where: { id: { not: creator.id }, isPrimary: true },
      data: { isPrimary: false },
    }),
  ]);

  return updatedCreator;
}

async function repairSingleChannelContent(db: PrismaExecutor, mainCreatorId: string) {
  if (flags.multiCreator) return;

  await Promise.all([
    db.video.updateMany({
      where: { creatorId: { not: mainCreatorId } },
      data: { creatorId: mainCreatorId },
    }),
    db.comment.updateMany({
      where: {
        OR: [
          { creatorId: null },
          { creatorId: { not: mainCreatorId } },
        ],
      },
      data: { creatorId: mainCreatorId },
    }),
  ]);
}

export class MainCreatorService {
  static get configuredSlug() {
    return getConfiguredMainCreatorSlug();
  }

  /**
   * Read-only public resolver. It never creates or mutates data.
   */
  static async getConfiguredMainCreator(db: PrismaExecutor = prisma) {
    const slug = getConfiguredMainCreatorSlug();
    if (!slug) return null;

    return db.creator.findUnique({ where: { slug } });
  }

  /**
   * Admin resolver for the monokanał: guarantees one approved primary creator
   * with the configured slug and optionally re-attaches legacy videos/comments.
   */
  static async getOrCreateForAdmin(adminUserId: string, db: PrismaExecutor = prisma, options: EnsureOptions = {}) {
    const slug = requireValidMainCreatorSlug();

    let creator = await db.creator.findUnique({ where: { slug } });

    if (!creator) {
      const candidate = await findBestExistingMainCreatorCandidate(db);

      if (candidate) {
        creator = await db.creator.update({
          where: { id: candidate.id },
          data: {
            slug,
            isApproved: true,
            isPrimary: true,
          },
        });
      } else {
        creator = await db.creator.create({
          data: {
            userId: adminUserId,
            name: MAIN_CREATOR_NAME,
            slug,
            isApproved: true,
            isPrimary: true,
          },
        });
      }
    }

    creator = await markAsOnlyPrimary(db, creator);

    if (options.repairSingleChannelContent) {
      await repairSingleChannelContent(db, creator.id);
    }

    return creator;
  }
}
