/**
 * One-off migration: copy thumbnails stored in Vercel Blob into the private R2
 * thumbnail bucket and repoint the DB at them (MEDIA-THUMBNAILS-R2-MIGRATION-001).
 *
 *   npx tsx scripts/migrate-thumbnails-to-r2.ts                 # dry run (default)
 *   npx tsx scripts/migrate-thumbnails-to-r2.ts --apply         # copy + update DB
 *   npx tsx scripts/migrate-thumbnails-to-r2.ts --rollback=<file.json>
 *
 * Covers Video.thumbnailUrl, the `default_video_thumbnail` AppSetting and
 * Creator.defaultThumbnailUrl. Published videos also get their public R2 copy
 * (Video.thumbnailPublicUrl) when the public bucket/host are configured.
 *
 * Blob objects are never deleted: every change is written to a JSON journal
 * (previous → next value) before moving on, and --rollback restores the
 * previous Blob URLs from it. Delete the Blob copies by hand only after the
 * R2 thumbnails are verified in production.
 */
import { PrismaClient } from '@prisma/client';
import { get } from '@vercel/blob';
import { readFileSync, writeFileSync } from 'fs';
import { R2ThumbnailStorageClient } from '@/lib/modules/media/infrastructure/r2-thumbnail-storage.client';
import { THUMBNAIL_EXTENSION_BY_MIME } from '@/lib/modules/media/domain/r2-thumbnail';

const prisma = new PrismaClient();
const SETTING_KEY = 'default_video_thumbnail';

type JournalEntry =
  | { kind: 'video'; id: string; previous: string; next: string; publicUrl: string | null }
  | { kind: 'appSetting'; id: string; previous: string; next: string }
  | { kind: 'creator'; id: string; previous: string; next: string };

function isBlobUrl(rawUrl: string | null | undefined): rawUrl is string {
  if (!rawUrl) return false;
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    if (hostname.endsWith('.blob.vercel-storage.com')) return true;
    const customHost = process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST;
    if (!customHost) return false;
    return hostname === new URL(customHost.startsWith('http') ? customHost : `https://${customHost}`).hostname.toLowerCase();
  } catch {
    return false;
  }
}

async function downloadBlob(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const result = await get(url, { access: 'private' }).catch(() => null);
  if (result?.stream) {
    const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
    return { bytes, contentType: result.headers.get('content-type') ?? guessContentType(url) };
  }

  // Public stores: a plain fetch works.
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Blob download failed (${response.status}) for ${url}`);
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? guessContentType(url),
  };
}

function guessContentType(url: string): string {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function copyToR2(client: R2ThumbnailStorageClient, url: string, scope: string) {
  const { bytes, contentType } = await downloadBlob(url);
  const type = contentType.split(';')[0].trim().toLowerCase();
  const extension = THUMBNAIL_EXTENSION_BY_MIME[type];
  if (!extension) throw new Error(`Unsupported content type ${type} for ${url}`);
  return client.putPrivate({ scope, bytes, contentType: type, extension });
}

async function migrate(apply: boolean) {
  if (!R2ThumbnailStorageClient.isConfigured()) {
    throw new Error('R2 thumbnails are not configured (CLOUDFLARE_R2_ACCOUNT_ID / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY / _BUCKET_THUMBNAILS_PRIVATE).');
  }
  const publicServing = R2ThumbnailStorageClient.isPublicServingConfigured();
  const client = new R2ThumbnailStorageClient();

  const videos = (await prisma.video.findMany({
    select: { id: true, status: true, thumbnailUrl: true },
    orderBy: { createdAt: 'asc' },
  })).filter((video) => isBlobUrl(video.thumbnailUrl));
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  const creators = (await prisma.creator.findMany({
    select: { id: true, defaultThumbnailUrl: true },
  })).filter((creator) => isBlobUrl(creator.defaultThumbnailUrl));

  console.log(`Blob thumbnails found: ${videos.length} video(s), ${isBlobUrl(setting?.value) ? 1 : 0} default AppSetting, ${creators.length} creator default(s).`);
  console.log(`Public R2 serving configured: ${publicServing ? 'yes' : 'no (published videos keep using the proxy)'}`);

  if (!apply) {
    for (const video of videos) console.log(`  [dry-run] video ${video.id} (${video.status}) ${video.thumbnailUrl}`);
    if (isBlobUrl(setting?.value)) console.log(`  [dry-run] AppSetting ${SETTING_KEY} ${setting!.value}`);
    for (const creator of creators) console.log(`  [dry-run] creator ${creator.id} ${creator.defaultThumbnailUrl}`);
    console.log('Dry run only. Re-run with --apply to migrate.');
    return;
  }

  const journalPath = `thumbnail-r2-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const journal: JournalEntry[] = [];
  const saveJournal = () => writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  saveJournal();
  console.log(`Journal: ${journalPath}`);

  let failures = 0;

  for (const video of videos) {
    try {
      const { key, storageUrl } = await copyToR2(client, video.thumbnailUrl, `videos/${video.id}/covers`);
      const entry: JournalEntry = { kind: 'video', id: video.id, previous: video.thumbnailUrl, next: storageUrl, publicUrl: null };
      journal.push(entry);
      saveJournal();

      await prisma.video.update({ where: { id: video.id }, data: { thumbnailUrl: storageUrl, thumbnailPublicUrl: null } });

      if (publicServing && video.status === 'PUBLISHED') {
        entry.publicUrl = await client.copyToPublic(key);
        await prisma.video.update({ where: { id: video.id }, data: { thumbnailPublicUrl: entry.publicUrl } });
        saveJournal();
      }
      console.log(`  ✓ video ${video.id} → ${storageUrl}${entry.publicUrl ? ` (public ${entry.publicUrl})` : ''}`);
    } catch (error) {
      failures++;
      console.error(`  ✗ video ${video.id}:`, error);
    }
  }

  if (setting && isBlobUrl(setting.value)) {
    try {
      const { storageUrl } = await copyToR2(client, setting.value, 'settings/default-video-thumbnail');
      journal.push({ kind: 'appSetting', id: SETTING_KEY, previous: setting.value, next: storageUrl });
      saveJournal();
      await prisma.appSetting.update({ where: { key: SETTING_KEY }, data: { value: storageUrl } });
      console.log(`  ✓ AppSetting ${SETTING_KEY} → ${storageUrl}`);
    } catch (error) {
      failures++;
      console.error(`  ✗ AppSetting ${SETTING_KEY}:`, error);
    }
  }

  for (const creator of creators) {
    try {
      const { storageUrl } = await copyToR2(client, creator.defaultThumbnailUrl!, `creators/${creator.id}/default-thumbnail`);
      journal.push({ kind: 'creator', id: creator.id, previous: creator.defaultThumbnailUrl!, next: storageUrl });
      saveJournal();
      await prisma.creator.update({ where: { id: creator.id }, data: { defaultThumbnailUrl: storageUrl } });
      console.log(`  ✓ creator ${creator.id} → ${storageUrl}`);
    } catch (error) {
      failures++;
      console.error(`  ✗ creator ${creator.id}:`, error);
    }
  }

  console.log(`Done: ${journal.length} migrated, ${failures} failed. Blob objects were left in place.`);
  if (failures > 0) process.exitCode = 1;
}

async function rollback(journalPath: string) {
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as JournalEntry[];
  let restored = 0;
  let skipped = 0;

  // Only restore rows still holding the value this migration wrote, so later
  // admin edits are never overwritten.
  for (const entry of journal) {
    if (entry.kind === 'video') {
      const result = await prisma.video.updateMany({
        where: { id: entry.id, thumbnailUrl: entry.next },
        data: { thumbnailUrl: entry.previous, thumbnailPublicUrl: null },
      });
      result.count ? restored++ : skipped++;
    } else if (entry.kind === 'appSetting') {
      const result = await prisma.appSetting.updateMany({
        where: { key: entry.id, value: entry.next },
        data: { value: entry.previous },
      });
      result.count ? restored++ : skipped++;
    } else {
      const result = await prisma.creator.updateMany({
        where: { id: entry.id, defaultThumbnailUrl: entry.next },
        data: { defaultThumbnailUrl: entry.previous },
      });
      result.count ? restored++ : skipped++;
    }
  }

  console.log(`Rollback: ${restored} restored to Blob URLs, ${skipped} skipped (changed since migration). Public R2 copies left behind are removed by the sync-public-thumbnails cron.`);
}

async function main() {
  const args = process.argv.slice(2);
  const rollbackArg = args.find((arg) => arg.startsWith('--rollback='));
  if (rollbackArg) {
    await rollback(rollbackArg.slice('--rollback='.length));
  } else {
    await migrate(args.includes('--apply'));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
