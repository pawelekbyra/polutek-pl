/**
 * One-off migration of the panel's subtitle files from the PUBLIC thumbnails bucket to the PRIVATE HLS bucket
 * (audit W01 / S10). Pure logic over ports; `scripts/migrate-captions-to-private.ts` wires the real R2 and database.
 *
 *   copy   : for every subtitle column that still holds a URL of our public host: read the public object, check it is
 *            WebVTT, store it as `videos/<id>/captions/<lang>-<sha256>.vtt` in the HLS bucket (skipped when it is
 *            already there), verify the stored size, and only then repoint the column to `hlscap:<file>`
 *            (compare-and-set: a column changed meanwhile is left alone). Nothing is deleted.
 *   delete : only when asked. Refuses to start while any column still points at the public host. A public file is
 *            deleted only after a private copy with identical content is confirmed; a public file with no such copy
 *            is an orphan (no row refers to it) and is deleted only with `includeOrphans`.
 *
 * Both phases are idempotent (a second run finds nothing to do) and have a dry-run mode that changes nothing.
 */
import { createHash } from "node:crypto";
import { validateVtt } from "../domain/files";
import { captionFileName, captionObjectKey, formatCaptionRef, parseCaptionRef } from "@/lib/modules/media";

export type CaptionColumn =
  | { kind: "video"; videoId: string; field: "subtitleUrlPl" | "subtitleUrlEn"; lang: "pl" | "en"; value: string }
  | { kind: "translation"; rowId: string; videoId: string; lang: string; value: string };

export interface CaptionMigrationPorts {
  /** Every subtitle column that holds a value. */
  listColumns(): Promise<CaptionColumn[]>;
  /** Sets the column to `next` only if it still equals `expected`. Returns whether it changed. */
  compareAndSet(column: CaptionColumn, expected: string, next: string): Promise<boolean>;
  /** Object key when `url` is a file of OUR public subtitle host, else null. */
  publicKeyOf(url: string): string | null;
  readPublic(key: string): Promise<Uint8Array | null>;
  listPublicSubtitleKeys(): Promise<string[]>;
  deletePublic(key: string): Promise<void>;
  headPrivate(key: string): Promise<{ sizeBytes: number } | null>;
  putPrivate(input: { videoId: string; lang: string; bytes: Uint8Array }): Promise<{ file: string; key: string }>;
}

export type CopyOutcome = "already-private" | "foreign" | "public-missing" | "invalid" | "copied" | "would-copy" | "changed-meanwhile";

export type CopyItem = {
  outcome: CopyOutcome;
  videoId: string;
  lang: string;
  column: string;
  previous: string;
  next?: string;
  legacyKey?: string;
  privateKey?: string;
  detail?: string;
};

export type JournalEntry = { column: CaptionColumn; previous: string; next: string; legacyKey: string; privateKey: string };

export type CopyReport = {
  dryRun: boolean;
  counts: Record<CopyOutcome, number>;
  items: CopyItem[];
  /** What changed (apply only): feeds the rollback file. */
  journal: JournalEntry[];
};

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const columnName = (c: CaptionColumn) => (c.kind === "video" ? `Video.${c.field}` : `VideoTranslation.subtitleUrl(${c.rowId})`);
const emptyCounts = (): Record<CopyOutcome, number> => ({ "already-private": 0, foreign: 0, "public-missing": 0, invalid: 0, copied: 0, "would-copy": 0, "changed-meanwhile": 0 });

export async function copyCaptionsToPrivate(ports: CaptionMigrationPorts, opts: { apply: boolean }): Promise<CopyReport> {
  const report: CopyReport = { dryRun: !opts.apply, counts: emptyCounts(), items: [], journal: [] };
  const push = (item: CopyItem) => {
    report.items.push(item);
    report.counts[item.outcome] += 1;
  };

  for (const column of await ports.listColumns()) {
    const base = { videoId: column.videoId, lang: column.lang, column: columnName(column), previous: column.value };
    if (parseCaptionRef(column.value)) {
      push({ ...base, outcome: "already-private" });
      continue;
    }
    const legacyKey = ports.publicKeyOf(column.value);
    if (!legacyKey) {
      // An external URL or a same-site path pasted in the old panel: not ours to move.
      push({ ...base, outcome: "foreign" });
      continue;
    }
    const bytes = await ports.readPublic(legacyKey);
    if (!bytes) {
      push({ ...base, outcome: "public-missing", legacyKey });
      continue;
    }
    const check = validateVtt(bytes);
    if (!check.ok) {
      push({ ...base, outcome: "invalid", legacyKey, detail: check.reason });
      continue;
    }
    const file = captionFileName(column.lang, sha256(bytes));
    const privateKey = captionObjectKey(column.videoId, file);
    const next = formatCaptionRef(file);
    if (!opts.apply) {
      push({ ...base, outcome: "would-copy", next, legacyKey, privateKey });
      continue;
    }
    const existing = await ports.headPrivate(privateKey);
    if (!existing || existing.sizeBytes !== bytes.length) await ports.putPrivate({ videoId: column.videoId, lang: column.lang, bytes });
    const verified = await ports.headPrivate(privateKey);
    if (!verified || verified.sizeBytes !== bytes.length) {
      throw new Error(`Private copy of ${legacyKey} could not be verified (${privateKey}); stopping before changing any further row.`);
    }
    const changed = await ports.compareAndSet(column, column.value, next);
    if (!changed) {
      push({ ...base, outcome: "changed-meanwhile", next, legacyKey, privateKey });
      continue;
    }
    report.journal.push({ column, previous: column.value, next, legacyKey, privateKey });
    push({ ...base, outcome: "copied", next, legacyKey, privateKey });
  }
  return report;
}

export type DeleteOutcome = "deleted" | "would-delete" | "orphan-kept" | "orphan-deleted" | "orphan-would-delete" | "unreadable";

export type DeleteReport = {
  dryRun: boolean;
  /** Set when the phase refused to run: columns still pointing at the public host. */
  blockedBy: string[] | null;
  counts: Record<DeleteOutcome, number>;
  items: Array<{ key: string; outcome: DeleteOutcome; privateKey?: string }>;
};

/**
 * Removes the old public files. `allowDelete` false (the default) lists what would be removed and deletes nothing.
 * `languages`: codes a private copy may be stored under (pl and every translation language).
 */
export async function deleteLegacyPublicCaptions(
  ports: CaptionMigrationPorts,
  opts: { allowDelete: boolean; includeOrphans: boolean; languages: readonly string[] },
): Promise<DeleteReport> {
  const counts: Record<DeleteOutcome, number> = { deleted: 0, "would-delete": 0, "orphan-kept": 0, "orphan-deleted": 0, "orphan-would-delete": 0, unreadable: 0 };
  const report: DeleteReport = { dryRun: !opts.allowDelete, blockedBy: null, counts, items: [] };

  const stillPublic = (await ports.listColumns()).filter((c) => !parseCaptionRef(c.value) && ports.publicKeyOf(c.value));
  if (stillPublic.length > 0) {
    report.blockedBy = stillPublic.map((c) => `${columnName(c)} of ${c.videoId}`);
    return report;
  }

  for (const key of await ports.listPublicSubtitleKeys()) {
    const videoId = /^videos\/([A-Za-z0-9-]{8,64})\/subtitles\//.exec(key)?.[1];
    const bytes = videoId ? await ports.readPublic(key) : null;
    if (!videoId || !bytes) {
      report.items.push({ key, outcome: "unreadable" });
      counts.unreadable += 1;
      continue;
    }
    const hash = sha256(bytes);
    let privateKey: string | undefined;
    for (const lang of opts.languages) {
      const candidate = captionObjectKey(videoId, captionFileName(lang, hash));
      const found = await ports.headPrivate(candidate);
      if (found && found.sizeBytes === bytes.length) {
        privateKey = candidate;
        break;
      }
    }
    const outcome: DeleteOutcome = privateKey
      ? opts.allowDelete ? "deleted" : "would-delete"
      : opts.includeOrphans ? (opts.allowDelete ? "orphan-deleted" : "orphan-would-delete") : "orphan-kept";
    if (opts.allowDelete && (outcome === "deleted" || outcome === "orphan-deleted")) await ports.deletePublic(key);
    report.items.push({ key, outcome, ...(privateKey ? { privateKey } : {}) });
    counts[outcome] += 1;
  }
  return report;
}

/** Puts the previous values back (compare-and-set: a column edited since is skipped). Only useful while the public files still exist. */
export async function rollbackCaptionColumns(ports: Pick<CaptionMigrationPorts, "compareAndSet">, journal: JournalEntry[]): Promise<{ restored: number; skipped: number }> {
  let restored = 0;
  let skipped = 0;
  for (const entry of journal) {
    if (await ports.compareAndSet(entry.column, entry.next, entry.previous)) restored += 1;
    else skipped += 1;
  }
  return { restored, skipped };
}
