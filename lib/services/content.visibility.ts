import { VideoStatus } from '@prisma/client';

export interface PublicVisibilityVideo {
  status: VideoStatus;
  publishedAt: Date | string | null;
  creator: {
    isApproved: boolean;
    isPrimary: boolean;
  } | null;
}

export type VideoVisibilityExplanation = {
  visible: boolean;
  reasons: string[];
};

export function isPubliclyVisibleVideo(video: PublicVisibilityVideo, now: Date = new Date()): boolean {
  const explanation = explainVideoVisibility(video, now);
  return explanation.visible;
}

export function explainVideoVisibility(video: PublicVisibilityVideo, now: Date = new Date()): VideoVisibilityExplanation {
  const reasons: string[] = [];

  if (video.status !== "PUBLISHED") {
    reasons.push(`status is ${video.status}`);
  }

  if (!video.creator) {
    reasons.push("missing creator");
  } else {
    if (!video.creator.isApproved) {
      reasons.push("creator is not approved");
    }
  }

  const pubAt = video.publishedAt ? new Date(video.publishedAt) : null;
  if (pubAt && pubAt > now) {
    reasons.push(`publishedAt is in the future (${pubAt.toISOString()})`);
  }

  return {
    visible: reasons.length === 0,
    reasons,
  };
}
