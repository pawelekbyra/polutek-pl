import { getMainChannel, getRequiredMainChannel, MainChannelMaintenance as NewMainChannelMaintenance, MainChannelNotFoundError as NewMainChannelNotFoundError, MainChannelNotApprovedError as NewMainChannelNotApprovedError, MainChannelNotPrimaryError as NewMainChannelNotPrimaryError } from '@/lib/modules/channel';
import { createAppContext, DbClient } from '@/lib/modules/shared/app-context';
import { prisma as globalPrisma } from '@/lib/prisma';
import { flags } from '@/lib/feature-flags';

/**
 * @deprecated Use @/lib/modules/channel instead.
 * This is a temporary adapter to avoid breaking existing imports during refactoring.
 */
export class MainChannelService {
  static getConfiguredSlug() {
    return flags.mainCreatorSlug || null;
  }

  static async getOptional(db: DbClient = globalPrisma) {
    const ctx = createAppContext({ prisma: db });
    return await getMainChannel(ctx);
  }

  static async getRequired(db: DbClient = globalPrisma) {
    const ctx = createAppContext({ prisma: db });
    return await getRequiredMainChannel(ctx);
  }

  static async getPublicRequired() {
    return await this.getRequired();
  }
}
