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

import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MAIN_CREATOR_SLUG } from '@/lib/constants';
import { flags } from '@/lib/feature-flags';
import {
  MainChannelNotFoundError,
  MainChannelNotApprovedError,
  MainChannelNotPrimaryError
} from './main-channel.errors';
import { MainChannelRecord } from './main-channel.types';

export class MainChannelService {
  static getConfiguredSlug(): string {
    return (flags.mainCreatorSlug || MAIN_CREATOR_SLUG).trim();
  }

  static async getOptional(db: { creator: PrismaClient['creator'] } = prisma): Promise<MainChannelRecord | null> {
    const slug = this.getConfiguredSlug();
    if (!slug) return null;

    return db.creator.findUnique({
      where: { slug },
    });
  }

  static async getRequired(db: { creator: PrismaClient['creator'] } = prisma): Promise<MainChannelRecord> {
    const slug = this.getConfiguredSlug();
    const channel = await this.getOptional(db);

    if (!channel) {
      throw new MainChannelNotFoundError(slug);
    }

    if (!channel.isApproved) {
      throw new MainChannelNotApprovedError(slug);
    }

    if (!channel.isPrimary) {
      throw new MainChannelNotPrimaryError(slug);
    }

    return channel;
  }

  /**
   * For public callers, we return null or throw if the channel is not ready/public.
   */
  static async getPublicRequired(db: { creator: PrismaClient['creator'] } = prisma): Promise<MainChannelRecord> {
    return this.getRequired(db);
  }
}
