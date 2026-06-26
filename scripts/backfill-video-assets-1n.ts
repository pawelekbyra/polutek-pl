import { PrismaClient } from '@prisma/client';
import { selectPrimaryVideoAsset } from '@/lib/modules/video/domain/video-asset-selection';

const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    select: {
      id: true,
      videoUrl: true,
      assets: {
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      },
    },
  });

  let assetsInspected = 0;
  let assetsChanged = 0;
  let legacyOnlyVideos = 0;

  for (const video of videos) {
    assetsInspected += video.assets.length;

    if (video.assets.length === 0) {
      if (video.videoUrl?.trim()) legacyOnlyVideos += 1;
      continue;
    }

    const selected = selectPrimaryVideoAsset(video.assets);
    if (!selected) continue;

    const primaryAssets = video.assets.filter((asset) => asset.isPrimary);
    if (primaryAssets.length === 1 && primaryAssets[0].id === selected.id) continue;

    const [, selectedUpdate] = await prisma.$transaction([
      prisma.videoAsset.updateMany({
        where: { videoId: video.id, id: { not: selected.id }, isPrimary: true },
        data: { isPrimary: false },
      }),
      selected.isPrimary
        ? prisma.videoAsset.findUnique({ where: { id: selected.id } })
        : prisma.videoAsset.update({ where: { id: selected.id }, data: { isPrimary: true } }),
    ]);

    assetsChanged += primaryAssets.filter((asset) => asset.id !== selected.id).length;
    if (!selected.isPrimary && selectedUpdate) assetsChanged += 1;
  }

  console.log('[backfill-video-assets-1n] complete', {
    videosInspected: videos.length,
    assetsInspected,
    assetsChanged,
    legacyOnlyVideos,
    legacyAssetCreation: 'skipped: StorageProvider has no LEGACY_URL value in this PR',
  });
}

main()
  .catch((error) => {
    console.error('[backfill-video-assets-1n] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
