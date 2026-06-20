import { AppContext } from "@/lib/modules/shared/app-context";
import { ChannelRepository } from "../infrastructure/channel.repository";
import { MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from "../domain/channel.errors";
import { flags } from "@/lib/feature-flags";
import { WriteTx } from "../../shared/db";

export class MainChannelService {
  static async getOptional(ctx: AppContext) {
    const repository = new ChannelRepository(ctx.prisma);
    return await repository.findMainChannel();
  }

  static async getRequired(ctx: AppContext) {
    const channel = await this.getOptional(ctx);
    const slug = flags.mainCreatorSlug;

    if (!channel) {
      throw new MainChannelNotFoundError(slug || 'unknown');
    }

    if (!channel.isApproved) {
      throw new MainChannelNotApprovedError(slug || 'unknown');
    }

    if (!channel.isPrimary) {
      throw new MainChannelNotPrimaryError(slug || 'unknown');
    }

    return channel;
  }

  static getConfiguredSlug() {
      return flags.mainCreatorSlug;
  }

  static async incrementSubscribersCount(ctx: AppContext, channelId: string, tx: WriteTx) {
    const repository = new ChannelRepository(tx);
    return await repository.updateSubscribersCount(channelId, 1, tx);
  }

  static async decrementSubscribersCount(ctx: AppContext, channelId: string, tx: WriteTx) {
    const repository = new ChannelRepository(tx);
    return await repository.updateSubscribersCount(channelId, -1, tx);
  }

  static async syncSubscribersCount(ctx: AppContext, channelId: string, tx: WriteTx) {
    const repository = new ChannelRepository(tx);
    return await repository.syncSubscribersCount(channelId, tx);
  }
}

/** @deprecated Use MainChannelService.getOptional */
export const getMainChannel = (ctx: AppContext) => MainChannelService.getOptional(ctx);
/** @deprecated Use MainChannelService.getRequired */
export const getRequiredMainChannel = (ctx: AppContext) => MainChannelService.getRequired(ctx);
