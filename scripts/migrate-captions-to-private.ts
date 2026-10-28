/**
 * Moves the panel's subtitle files from the PUBLIC thumbnails bucket to the PRIVATE HLS bucket and repoints the
 * database at them (audit W01 / S10; docs/operations/HLS-SELF-HOSTED.md "Napisy"). Logic and its tests:
 * lib/modules/admin-content/application/captions-migration.ts.
 *
 *   npx tsx scripts/migrate-captions-to-private.ts                       # DRY RUN (default): changes nothing
 *   npx tsx scripts/migrate-captions-to-private.ts --apply               # copy + verify + repoint rows; deletes nothing
 *   npx tsx scripts/migrate-captions-to-private.ts --apply --delete-legacy [--include-orphans]
 *                                                                        # + delete old public files (verified copies only)
 *   npx tsx scripts/migrate-captions-to-private.ts --delete-legacy       # dry run of the delete phase (lists, deletes nothing)
 *   npx tsx scripts/migrate-captions-to-private.ts --rollback=<journal.json> --apply
 *
 * Options: --report=<file.json> (default captions-migration-report-<time>.json, written also in dry run),
 *          --journal=<file.json> (default captions-migration-journal-<time>.json, written only with --apply).
 *
 * Order: deploy the Worker, then the app, then --apply; check playback; only then --apply --delete-legacy and purge
 * the CDN cache of the public host (the report lists the URLs). Needs DATABASE_URL and CLOUDFLARE_R2_*
 * (token with Object Read & Write on the public thumbnails bucket and the HLS bucket).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "fs";
import { R2CaptionStorageClient, R2ThumbnailStorageClient, getR2ThumbnailConfig, parsePublicThumbnailUrl } from "@/lib/modules/media";
import { TRANSLATION_LANGUAGES, ORIGINAL_LANGUAGE } from "@/lib/modules/translations/domain/languages";
import {
  copyCaptionsToPrivate,
  deleteLegacyPublicCaptions,
  rollbackCaptionColumns,
  type CaptionColumn,
  type CaptionMigrationPorts,
  type JournalEntry,
} from "@/lib/modules/admin-content/application/captions-migration";

const args = new Set(process.argv.slice(2).filter((a) => !a.includes("=")));
const option = (name: string) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = args.has("--apply");
const DELETE_LEGACY = args.has("--delete-legacy");
const INCLUDE_ORPHANS = args.has("--include-orphans");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = option("report") ?? `captions-migration-report-${stamp}.json`;
const journalPath = option("journal") ?? `captions-migration-journal-${stamp}.json`;
const rollbackPath = option("rollback");

const prisma = new PrismaClient();

function makePorts(): CaptionMigrationPorts {
  const captions = new R2CaptionStorageClient();
  const thumbs = new R2ThumbnailStorageClient();
  return {
    async listColumns() {
      const [videos, translations] = await Promise.all([
        prisma.video.findMany({
          where: { OR: [{ subtitleUrlPl: { not: null } }, { subtitleUrlEn: { not: null } }] },
          select: { id: true, subtitleUrlPl: true, subtitleUrlEn: true },
        }),
        prisma.videoTranslation.findMany({ where: { subtitleUrl: { not: null } }, select: { id: true, videoId: true, language: true, subtitleUrl: true } }),
      ]);
      const columns: CaptionColumn[] = [];
      for (const v of videos) {
        if (v.subtitleUrlPl) columns.push({ kind: "video", videoId: v.id, field: "subtitleUrlPl", lang: "pl", value: v.subtitleUrlPl });
        if (v.subtitleUrlEn) columns.push({ kind: "video", videoId: v.id, field: "subtitleUrlEn", lang: "en", value: v.subtitleUrlEn });
      }
      for (const t of translations) columns.push({ kind: "translation", rowId: t.id, videoId: t.videoId, lang: t.language, value: t.subtitleUrl as string });
      return columns;
    },
    async compareAndSet(column, expected, next) {
      const result =
        column.kind === "video"
          ? await prisma.video.updateMany({ where: { id: column.videoId, [column.field]: expected }, data: { [column.field]: next } })
          : await prisma.videoTranslation.updateMany({ where: { id: column.rowId, subtitleUrl: expected }, data: { subtitleUrl: next } });
      return result.count > 0;
    },
    publicKeyOf(url) {
      const key = parsePublicThumbnailUrl(url, process.env);
      return key && /^videos\/[A-Za-z0-9-]{8,64}\/subtitles\//.test(key) ? key : null;
    },
    readPublic: (key) => thumbs.getPublic(key),
    async listPublicSubtitleKeys() {
      return (await thumbs.listPublicObjects()).map((o) => o.key).filter((k) => k.includes("/subtitles/"));
    },
    deletePublic: (key) => thumbs.deletePublic(key),
    headPrivate: (key) => captions.headCaption(key),
    putPrivate: (input) => captions.putCaption(input),
  };
}

function printCounts(title: string, counts: Record<string, number>) {
  console.log(`\n${title}`);
  for (const [name, n] of Object.entries(counts)) if (n > 0) console.log(`  ${name.padEnd(22)} ${n}`);
}

async function main() {
  if (!R2CaptionStorageClient.isConfigured() || !R2ThumbnailStorageClient.isPublicServingConfigured()) {
    throw new Error("CLOUDFLARE_R2_* (incl. CLOUDFLARE_R2_BUCKET_THUMBNAILS_PUBLIC and NEXT_PUBLIC_R2_PUBLIC_HOST) must be set.");
  }
  const ports = makePorts();
  const publicHost = getR2ThumbnailConfig(process.env).publicHost;
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN (nothing is changed)"} | delete legacy: ${DELETE_LEGACY ? (APPLY ? "YES" : "dry run") : "no"} | HLS bucket: ${R2CaptionStorageClient.bucket()} | public host: ${publicHost}`);

  if (rollbackPath) {
    const journal = JSON.parse(readFileSync(rollbackPath, "utf8")) as JournalEntry[];
    if (!APPLY) {
      console.log(`Rollback dry run: ${journal.length} journal entries would be restored. Add --apply to do it.`);
      return;
    }
    console.log("Rollback result:", await rollbackCaptionColumns(ports, journal));
    return;
  }

  const copy = await copyCaptionsToPrivate(ports, { apply: APPLY });
  printCounts("Copy phase", copy.counts);
  for (const item of copy.items) {
    if (item.outcome === "invalid" || item.outcome === "public-missing" || item.outcome === "changed-meanwhile") {
      console.log(`  ! ${item.outcome}: ${item.column} of ${item.videoId} (${item.legacyKey ?? item.previous})${item.detail ? ` - ${item.detail}` : ""}`);
    }
  }
  if (APPLY && copy.journal.length > 0) {
    writeFileSync(journalPath, JSON.stringify(copy.journal, null, 2));
    console.log(`Journal (for --rollback): ${journalPath}`);
  }

  let deleteReport = null;
  if (DELETE_LEGACY) {
    const languages = [ORIGINAL_LANGUAGE, ...TRANSLATION_LANGUAGES.map((l) => l.code)];
    deleteReport = await deleteLegacyPublicCaptions(ports, { allowDelete: APPLY, includeOrphans: INCLUDE_ORPHANS, languages });
    if (deleteReport.blockedBy) {
      console.log(`\nDelete phase REFUSED: ${deleteReport.blockedBy.length} column(s) still point at the public host (run --apply first):`);
      for (const c of deleteReport.blockedBy.slice(0, 20)) console.log(`  - ${c}`);
    } else {
      printCounts(deleteReport.dryRun ? "Delete phase (dry run)" : "Delete phase", deleteReport.counts);
      const urls = deleteReport.items.filter((i) => /deleted|would-delete/.test(i.outcome)).map((i) => `https://${publicHost}/${i.key}`);
      console.log(`\nPurge these URLs from the CDN cache of ${publicHost} (R2 deletion does not purge it): ${urls.length}`);
    }
  }

  writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), apply: APPLY, deleteLegacy: DELETE_LEGACY, copy, delete: deleteReport }, null, 2));
  console.log(`\nReport: ${reportPath}`);
  if (!APPLY) console.log("This was a dry run. Add --apply to perform the copy (deleting also needs --delete-legacy).");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
