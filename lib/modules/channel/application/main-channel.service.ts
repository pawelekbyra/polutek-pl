import { AppContext } from "@/lib/modules/shared/app-context";
import { ChannelRepository } from "../infrastructure/channel.repository";
import { MainChannelNotFoundError, MainChannelNotApprovedError, MainChannelNotPrimaryError } from "../domain/channel.errors";
import { flags } from "@/lib/feature-flags";

export async function getMainChannel(ctx: AppContext) {
  const repository = new ChannelRepository(ctx.prisma);
  return await repository.findMainChannel();
}

export async function getRequiredMainChannel(ctx: AppContext) {
  const channel = await getMainChannel(ctx);
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
