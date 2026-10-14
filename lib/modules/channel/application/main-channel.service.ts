import { cache } from "react";
import { AppContext } from "@/lib/modules/shared/app-context";
import { ChannelRepository } from "../infrastructure/channel.repository";
import { ChannelNotFoundError, MainChannelNotFoundError, MainChannelNotApprovedError } from "../domain/channel.errors";
import { MainChannelPolicy } from "../domain/channel.policy";
import { ReadDb, WriteTx } from "../../shared/db";

/**
 * One main-channel read per server render and database client: the home page asks for it from the
 * video list, the featured video, the sidebar and the access check. React `cache` is request-scoped
 * and does not memoize outside a render (route handlers, actions, scripts), and a transaction
 * client is a different key, so a write path never reads a stale row.
 */
const findMainChannel = cache((db: ReadDb) => new ChannelRepository(db).findMainChannel());
const findChannelById = cache((db: ReadDb, id: string) => new ChannelRepository(db).findById(id));

/**
 * The platform's main channel (the one the home page shows) from the `main_channel_id` setting, or null.
 * One place resolves it (CLAUDE.md 4.24); `Creator.isPrimary` and `MAIN_CREATOR_SLUG` are no longer the source.
 */
export async function resolveMainChannel(db: ReadDb) {
  return await findMainChannel(db);
}

export async function resolveMainChannelId(db: ReadDb): Promise<string | null> {
  return (await findMainChannel(db))?.id ?? null;
}

/** Is this channel the platform's main channel? Replaces every `isPrimary` comparison (protection from suspension, limits, avatar). */
export async function isMainChannelId(db: ReadDb, channelId: string | null | undefined): Promise<boolean> {
  if (!channelId) return false;
  return (await resolveMainChannelId(db)) === channelId;
}

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

    if (!channel) {
      throw new MainChannelNotFoundError('main');
    }

    // Public visibility is the channel status alone (ACTIVE or LIMITED, not deleted), CLAUDE.md 4.24.
    if (!MainChannelPolicy.isPubliclyVisible(channel)) {
      throw new MainChannelNotApprovedError(channel.slug);
    }

    return channel;
  }

  /**
   * A channel addressed by id for a public, viewer-facing action (subscribing): it must exist and be publicly visible
   * (CLAUDE.md 4.24). A hidden or missing channel is the same 404, so the answer does not reveal which one it is (4.23).
   */
  static async getPubliclyVisibleById(ctx: AppContext, channelId: string) {
    const channel = await findChannelById(ctx.prisma, channelId);
    if (!channel || isGone(channel) || !MainChannelPolicy.isPubliclyVisible(channel)) {
      throw new ChannelNotFoundError(channelId);
    }
    return channel;
  }

  /**
   * A channel addressed by id regardless of visibility (a viewer may always leave a channel that was suspended or
   * deleted). Missing = 404.
   */
  static async getAnyById(ctx: AppContext, channelId: string) {
    const channel = await findChannelById(ctx.prisma, channelId);
    if (!channel) throw new ChannelNotFoundError(channelId);
    return channel;
  }

  /** Id of the platform's main channel (the `main_channel_id` setting), or null when none is configured. */
  static async getMainChannelId(ctx: AppContext): Promise<string | null> {
    return await resolveMainChannelId(ctx.prisma);
  }

  /** Stable slug of the main channel (for the sitemap and demo fallbacks), or null. */
  static async getMainSlug(ctx: AppContext): Promise<string | null> {
    return (await findMainChannel(ctx.prisma))?.slug ?? null;
  }

  /** The one place that answers "is this the main channel" (replaces `Creator.isPrimary`). */
  static async isMainChannel(ctx: AppContext, channelId: string | null | undefined): Promise<boolean> {
    return await isMainChannelId(ctx.prisma, channelId);
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
