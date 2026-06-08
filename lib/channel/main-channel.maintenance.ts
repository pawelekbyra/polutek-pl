import { MainChannelMaintenance as NewMaintenance } from "../modules/channel/application/main-channel.maintenance";
import { createAppContext } from "../modules/shared/app-context";

/** @deprecated Use @/lib/modules/channel/application/main-channel.maintenance */
export class MainChannelMaintenance {
  static async previewMainChannelSetup(userId?: string) {
    const ctx = createAppContext({ actor: userId ? { type: 'admin', userId } : { type: 'guest' } });
    return NewMaintenance.previewMainChannelSetup(ctx);
  }

  static async applyMainChannelSetup(adminUserId: string, confirmationPhrase: string) {
    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId } });
    return NewMaintenance.applyMainChannelSetup(ctx, confirmationPhrase);
  }

  static async applyOwnershipRepair(adminUserId: string, mainChannelId: string, confirmationPhrase: string) {
    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId } });
    return NewMaintenance.applyOwnershipRepair(ctx, mainChannelId, confirmationPhrase);
  }

  static async applyPrimaryRepair(adminUserId: string, mainChannelId: string, confirmationPhrase: string) {
    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId } });
    return NewMaintenance.applyPrimaryRepair(ctx, mainChannelId, confirmationPhrase);
  }
}
