import type { VideoAsset } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE } from "./video-asset.constants";

type SelectableVideoAsset = Pick<VideoAsset, "id" | "isPrimary" | "processingState" | "createdAt" | "updatedAt">;

function byNewestThenId(a: SelectableVideoAsset, b: SelectableVideoAsset): number {
  const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (updatedDelta !== 0) return updatedDelta;

  const createdDelta = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdDelta !== 0) return createdDelta;

  return a.id.localeCompare(b.id);
}

export function selectPrimaryVideoAsset<T extends SelectableVideoAsset>(
  assets: T[] | null | undefined
): T | null {
  if (!assets?.length) return null;

  const ordered = [...assets].sort(byNewestThenId);
  const primaryAssets = ordered.filter((asset) => asset.isPrimary);

  if (primaryAssets.length === 1) return primaryAssets[0];
  if (primaryAssets.length > 1) {
    console.warn("[VIDEO_ASSET_SELECTION] Multiple primary video assets detected; using deterministic newest asset.", {
      assetIds: primaryAssets.map((asset) => asset.id),
    });
    return primaryAssets[0];
  }

  return ordered.find((asset) => asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) ?? ordered[0];
}

export function withPrimaryAsset<T extends { assets?: VideoAsset[] | null }>(
  video: T | null
): (T & { asset: VideoAsset | null }) | null {
  if (!video) return null;
  return {
    ...video,
    asset: selectPrimaryVideoAsset(video.assets),
  };
}
