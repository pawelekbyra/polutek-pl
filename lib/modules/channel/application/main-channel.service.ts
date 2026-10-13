import { cache } from "react";
import { AppContext } from "@/lib/modules/shared/app-context";
import { ChannelRepository } from "../infrastructure/channel.repository";
import { ChannelNotFoundError, MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from "../domain/channel.errors";
import { flags } from "@/lib/feature-flags";
import { ReadDb, WriteTx } from "../../shared/db";

/**
 * One main-channel read per server render and database client: the home page asks for it from the
 * video list, the featured video, the sidebar and the access check. React `cache` is request-scoped
 * and does not memoize outside a render (route handlers, actions, scripts), and a transaction
 * client is a different key, so a write path never reads a stale row.
 */
const findMainChannel = cache((db: ReadDb) => new ChannelRepository(db).findMainChannel());
const findChannelById = cache((db: ReadDb, id: string) => new ChannelRepository(db).findById(id));

/** A channel that was soft deleted (or marked DELETED) is not found for any context. */
function isGone(channel: { status?: string | null; deletedAt?: Date | null }): boolean {
  return channel.status === 'DELETED' || channel.deletedAt != null;
}

export class MainChannelService {
  /**
   * The channel of this context: `ctx.channelId` when a Studio or panel entry point set it, otherwise the
   * configured main channel (the public site). The name is historical; see CLAUDE.md 4.24.
   */
  static async getOptional(ctx: AppContext) {
    if (ctx.channelId) {
      const channel = await findChannelById(ctx.prisma, ctx.channelId);
      return channel && !isGone(channel) ? channel : null;
    }
    return await findMainChannel(ctx.prisma);
  }

  static async getRequired(ctx: AppContext) {
    if (ctx.channelId) {
      const channel = await findChannelById(ctx.prisma, ctx.channelId);
      if (!channel || isGone(channel)) throw new ChannelNotFoundError(ctx.channelId);
      return channel;
    }

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
