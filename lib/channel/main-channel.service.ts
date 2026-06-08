import { MainChannelService as NewService } from "../modules/channel/application/main-channel.service";
import { createAppContext } from "../modules/shared/app-context";
import { DbClient } from "../modules/shared/db";

/** @deprecated Use @/lib/modules/channel/application/main-channel.service */
export class MainChannelService {
  static async getRequired(prisma?: DbClient) {
    const ctx = createAppContext({ prisma });
    return NewService.getRequired(ctx);
  }

  static async getOptional(prisma?: DbClient) {
    const ctx = createAppContext({ prisma });
    return NewService.getOptional(ctx);
  }

  static getConfiguredSlug() {
      return NewService.getConfiguredSlug();
  }

  static async getPublicRequired() {
      const ctx = createAppContext();
      return NewService.getRequired(ctx);
  }
}
