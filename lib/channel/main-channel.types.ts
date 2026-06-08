import { Creator } from '@prisma/client';

export type MainChannelRecord = Creator;

export interface MainChannelSetupPreview {
  mainChannelId: string | null;
  mainChannelSlug: string;
  videosOutsideMainChannel: number;
  publishedVideosOutsideMainChannel: number;
  commentsWithoutCreatorId: number;
  commentsOutsideMainChannel: number;
  paymentsOutsideMainChannel: number;
  subscriptionsOutsideMainChannel: number;
  primaryCreatorsCount: number;
  approvedCreatorsCount: number;
  totalCreatorsCount: number;
}
