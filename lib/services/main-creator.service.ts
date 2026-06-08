/*
 * This app is strict single-channel.
 *
 * Creator is a legacy Prisma model used as the database representation
 * of the MainChannel.
 *
 * Runtime page loads and normal API requests may read the main channel,
 * but must never create, rename, approve, demote, mark primary, or reassign
 * creators/videos/comments as a side effect.
 *
 * Setup and ownership repair are maintenance-only operations. They must be
 * explicit, previewable, confirmed, and auditable.
 */

import { Prisma, type Creator } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MainChannelService } from '../channel/main-channel.service';

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

export class MainCreatorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MainCreatorConfigurationError';
  }
}

export class MainCreatorService {
  static get configuredSlug() {
    return MainChannelService.getConfiguredSlug();
  }

  /**
   * Read-only public resolver. It never creates or mutates data.
   * Delegated to MainChannelService.
   */
  static async getConfiguredMainCreator(db: PrismaExecutor = prisma) {
    // We cast db to any because MainChannelService expects a specific shape
    // and Prisma.TransactionClient might not perfectly match it in type system
    // but works at runtime.
    return MainChannelService.getOptional(db as any);
  }

  /**
   * DEPRECATED: Runtime page loads and normal API requests must not use this.
   * Use MainChannelService.getRequired() for read-only access.
   * Use MainChannelMaintenance for setup/repair.
   */
  static async getOrCreateForAdmin(adminUserId: string, db: PrismaExecutor = prisma, options: any = {}) {
    console.warn("MainCreatorService.getOrCreateForAdmin is DEPRECATED and should not be used in runtime.");
    return MainChannelService.getRequired(db as any);
  }
}
