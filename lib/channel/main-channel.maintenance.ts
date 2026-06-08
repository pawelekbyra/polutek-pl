import { MainChannelMaintenance as NewMainChannelMaintenance } from '@/lib/modules/channel';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { prisma } from '@/lib/prisma';

/**
 * @deprecated Use @/lib/modules/channel instead.
 */
export class MainChannelMaintenance {
  static async previewMainChannelSetup() {
    const ctx = createAppContext({ prisma, actor: { type: 'system', reason: 'Legacy maintenance adapter' } });
    return await NewMainChannelMaintenance.previewMainChannelSetup(ctx);
  }

  static async applyMainChannelSetup(adminUserId: string, confirmationPhrase: string) {
    const ctx = createAppContext({ prisma, actor: { type: 'admin', userId: adminUserId } });
    return await NewMainChannelMaintenance.applyMainChannelSetup(ctx, adminUserId, confirmationPhrase);
  }

  static async applyOwnershipRepair(mainChannelId: string, confirmationPhrase: string) {
    const ctx = createAppContext({ prisma, actor: { type: 'system', reason: 'Legacy maintenance adapter repair' } });
    return await NewMainChannelMaintenance.applyOwnershipRepair(ctx, mainChannelId, confirmationPhrase);
  }

  static async applyPrimaryRepair(mainChannelId: string, confirmationPhrase: string) {
    const ctx = createAppContext({ prisma, actor: { type: 'system', reason: 'Legacy maintenance adapter repair' } });
    return await NewMainChannelMaintenance.applyPrimaryRepair(ctx, mainChannelId, confirmationPhrase);
  }
}
