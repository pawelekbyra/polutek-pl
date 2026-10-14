import type {
  AudienceCounts,
  ChannelFacts,
  DayCount,
  DayPlayback,
  RetentionBucket,
  SnapshotRow,
  VideoPlayback,
  VideoRow,
} from "./types";

/**
 * What the read models need from storage. Every method is already scoped to one channel (and optionally one video
 * of it) and to a time window; none returns a row that identifies a viewer.
 */
export interface AnalyticsRepository {
  channelFacts(channelId: string): Promise<ChannelFacts | null>;
  viewsByDay(channelId: string, from: Date, to: Date, videoId?: string): Promise<DayCount[]>;
  playbackByDay(channelId: string, from: Date, to: Date, videoId?: string): Promise<DayPlayback[]>;
  viewsByVideo(channelId: string, from: Date, to: Date): Promise<{ videoId: string; value: number }[]>;
  playbackByVideo(channelId: string, from: Date, to: Date): Promise<VideoPlayback[]>;
  commentsByVideo(channelId: string, from: Date, to: Date): Promise<{ videoId: string; value: number }[]>;
  likesByVideo(channelId: string, from: Date, to: Date): Promise<{ videoId: string; value: number }[]>;
  commentCount(channelId: string, from: Date, to: Date): Promise<number>;
  newSubscriptions(channelId: string, from: Date, to: Date): Promise<number>;
  /** Snapshots with `day` in [fromDay, toDay], oldest first. */
  snapshots(channelId: string, fromDay: string, toDay: string): Promise<SnapshotRow[]>;
  latestSnapshotDay(channelId: string): Promise<string | null>;
  channelVideos(channelId: string, limit: number): Promise<VideoRow[]>;
  video(channelId: string, videoId: string): Promise<VideoRow | null>;
  retentionBuckets(channelId: string, videoId: string, from: Date, to: Date): Promise<RetentionBucket[]>;
  audience(channelId: string, videoId: string, from: Date, to: Date): Promise<AudienceCounts>;
}
