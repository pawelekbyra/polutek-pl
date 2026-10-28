import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  copyCaptionsToPrivate,
  deleteLegacyPublicCaptions,
  rollbackCaptionColumns,
  type CaptionColumn,
  type CaptionMigrationPorts,
} from "@/lib/modules/admin-content/application/captions-migration";

const HOST = "https://thumbs.example.com/";
const V1 = "c52f0407-b0e8-4b5c-b6d3-a9f152653002";
const V2 = "11111111-2222-3333-4444-555555555555";
const vtt = (text: string) => new TextEncoder().encode(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${text}\n`);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const LANGS = ["pl", "en", "de"];

/** In-memory database, public bucket and private (HLS) bucket. */
function world(init: { columns: CaptionColumn[]; pub: Record<string, Uint8Array> }) {
  const columns = init.columns.map((c) => ({ ...c }));
  const pub = new Map(Object.entries(init.pub));
  const priv = new Map<string, Uint8Array>();
  const calls = { put: 0, deletePublic: [] as string[] };
  const ports: CaptionMigrationPorts = {
    async listColumns() {
      return columns.map((c) => ({ ...c }));
    },
    async compareAndSet(column, expected, next) {
      const live = columns.find((c) => (c.kind === "video" ? column.kind === "video" && c.videoId === column.videoId && c.field === column.field : column.kind === "translation" && c.rowId === column.rowId));
      if (!live || live.value !== expected) return false;
      live.value = next;
      return true;
    },
    publicKeyOf: (url) => (url.startsWith(HOST) && url.includes("/subtitles/") ? url.slice(HOST.length) : null),
    readPublic: async (key) => pub.get(key) ?? null,
    listPublicSubtitleKeys: async () => [...pub.keys()].filter((k) => k.includes("/subtitles/")),
    async deletePublic(key) {
      calls.deletePublic.push(key);
      pub.delete(key);
    },
    headPrivate: async (key) => (priv.has(key) ? { sizeBytes: priv.get(key)!.length } : null),
    async putPrivate({ videoId, lang, bytes }) {
      calls.put += 1;
      const file = `${lang}-${sha(bytes)}.vtt`;
      const key = `videos/${videoId}/captions/${file}`;
      priv.set(key, bytes);
      return { file, key };
    },
  };
  return { ports, columns, pub, priv, calls };
}

const PL = vtt("Cześć");
const EN = vtt("Hello");
const keyPl = `videos/${V1}/subtitles/pl.vtt`;
const keyEn = `videos/${V1}/subtitles/en.vtt`;

function standard() {
  return world({
    columns: [
      { kind: "video", videoId: V1, field: "subtitleUrlPl", lang: "pl", value: HOST + keyPl },
      { kind: "video", videoId: V1, field: "subtitleUrlEn", lang: "en", value: HOST + keyEn },
      { kind: "translation", rowId: "t1", videoId: V1, lang: "en", value: HOST + keyEn },
    ],
    pub: { [keyPl]: PL, [keyEn]: EN },
  });
}

describe("captions migration: copy phase", () => {
  it("dry run (the default) reports what it would do and changes nothing", async () => {
    const w = standard();
    const report = await copyCaptionsToPrivate(w.ports, { apply: false });
    expect(report.dryRun).toBe(true);
    expect(report.counts["would-copy"]).toBe(3);
    expect(report.journal).toEqual([]);
    expect(w.priv.size).toBe(0);
    expect(w.calls.put).toBe(0);
    expect(w.columns.every((c) => c.value.startsWith(HOST))).toBe(true);
  });

  it("copies, verifies, then repoints every column to a reference; public files stay", async () => {
    const w = standard();
    const report = await copyCaptionsToPrivate(w.ports, { apply: true });
    expect(report.counts.copied).toBe(3);
    expect(w.columns.map((c) => c.value)).toEqual([`hlscap:pl-${sha(PL)}.vtt`, `hlscap:en-${sha(EN)}.vtt`, `hlscap:en-${sha(EN)}.vtt`]);
    expect([...w.priv.keys()].sort()).toEqual([`videos/${V1}/captions/en-${sha(EN)}.vtt`, `videos/${V1}/captions/pl-${sha(PL)}.vtt`]);
    expect(w.priv.get(`videos/${V1}/captions/pl-${sha(PL)}.vtt`)).toEqual(PL);
    expect(w.pub.size).toBe(2);
    expect(w.calls.deletePublic).toEqual([]);
    expect(report.journal).toHaveLength(3);
  });

  it("is idempotent: a second run finds nothing to do and writes nothing", async () => {
    const w = standard();
    await copyCaptionsToPrivate(w.ports, { apply: true });
    const puts = w.calls.put;
    const again = await copyCaptionsToPrivate(w.ports, { apply: true });
    expect(again.counts["already-private"]).toBe(3);
    expect(again.counts.copied).toBe(0);
    expect(w.calls.put).toBe(puts);
    expect(again.journal).toEqual([]);
  });

  it("does not re-upload an identical private object that already exists (a repeat after a crash)", async () => {
    const w = standard();
    await w.ports.putPrivate({ videoId: V1, lang: "pl", bytes: PL });
    const before = w.calls.put;
    await copyCaptionsToPrivate(w.ports, { apply: true });
    // pl existed already; en is uploaded once for both its columns.
    expect(w.calls.put - before).toBe(1);
  });

  it("leaves foreign URLs, missing and invalid files alone and says so", async () => {
    const w = world({
      columns: [
        { kind: "video", videoId: V1, field: "subtitleUrlPl", lang: "pl", value: "https://cdn.other.example/a.vtt" },
        { kind: "video", videoId: V1, field: "subtitleUrlEn", lang: "en", value: HOST + keyEn },
        { kind: "translation", rowId: "t9", videoId: V2, lang: "de", value: `${HOST}videos/${V2}/subtitles/de.vtt` },
        { kind: "translation", rowId: "t8", videoId: V2, lang: "es", value: `${HOST}videos/${V2}/subtitles/es.vtt` },
      ],
      pub: { [keyEn]: new TextEncoder().encode("not vtt"), [`videos/${V2}/subtitles/es.vtt`]: vtt("Hola") },
    });
    const report = await copyCaptionsToPrivate(w.ports, { apply: true });
    expect(report.counts).toMatchObject({ foreign: 1, invalid: 1, "public-missing": 1, copied: 1 });
    expect(w.columns[0].value).toBe("https://cdn.other.example/a.vtt");
    expect(w.columns[1].value).toBe(HOST + keyEn);
    expect(w.columns[2].value).toBe(`${HOST}videos/${V2}/subtitles/de.vtt`);
    expect(w.columns[3].value).toMatch(/^hlscap:es-/);
  });

  it("does not overwrite a column that was edited meanwhile", async () => {
    const w = standard();
    const racing: CaptionMigrationPorts = {
      ...w.ports,
      async putPrivate(input) {
        const out = await w.ports.putPrivate(input);
        if (input.lang === "pl") w.columns[0].value = "hlscap:pl-" + "e".repeat(64) + ".vtt";
        return out;
      },
    };
    const report = await copyCaptionsToPrivate(racing, { apply: true });
    expect(report.counts["changed-meanwhile"]).toBe(1);
    expect(w.columns[0].value).toBe("hlscap:pl-" + "e".repeat(64) + ".vtt");
  });

  it("stops before touching a row when the private copy cannot be verified", async () => {
    const w = standard();
    const broken: CaptionMigrationPorts = { ...w.ports, headPrivate: async () => null };
    await expect(copyCaptionsToPrivate(broken, { apply: true })).rejects.toThrow(/could not be verified/);
    expect(w.columns.every((c) => c.value.startsWith(HOST))).toBe(true);
  });

  it("rollback puts the previous URLs back, skipping a column edited since", async () => {
    const w = standard();
    const { journal } = await copyCaptionsToPrivate(w.ports, { apply: true });
    w.columns[1].value = "https://edited.example/x.vtt";
    const result = await rollbackCaptionColumns(w.ports, journal);
    expect(result).toEqual({ restored: 2, skipped: 1 });
    expect(w.columns[0].value).toBe(HOST + keyPl);
    expect(w.columns[1].value).toBe("https://edited.example/x.vtt");
  });
});

describe("captions migration: delete phase", () => {
  const opts = { allowDelete: true, includeOrphans: false, languages: LANGS };

  it("refuses to run while any column still points at the public host", async () => {
    const w = standard();
    const r = await deleteLegacyPublicCaptions(w.ports, opts);
    expect(r.blockedBy).toHaveLength(3);
    expect(w.calls.deletePublic).toEqual([]);
    expect(w.pub.size).toBe(2);
  });

  it("dry run lists the verified files and deletes nothing", async () => {
    const w = standard();
    await copyCaptionsToPrivate(w.ports, { apply: true });
    const r = await deleteLegacyPublicCaptions(w.ports, { ...opts, allowDelete: false });
    expect(r.dryRun).toBe(true);
    expect(r.counts["would-delete"]).toBe(2);
    expect(w.calls.deletePublic).toEqual([]);
  });

  it("deletes only files with a verified identical private copy; orphans stay unless asked", async () => {
    const w = standard();
    const orphanKey = `videos/${V1}/subtitles/replaced-long-ago.vtt`;
    w.pub.set(orphanKey, vtt("Stary tekst"));
    await copyCaptionsToPrivate(w.ports, { apply: true });
    const r = await deleteLegacyPublicCaptions(w.ports, opts);
    expect(r.counts).toMatchObject({ deleted: 2, "orphan-kept": 1 });
    expect(w.calls.deletePublic.sort()).toEqual([keyEn, keyPl].sort());
    expect([...w.pub.keys()]).toEqual([orphanKey]);
    // Every private copy is still there.
    expect(w.priv.size).toBe(2);

    const swept = await deleteLegacyPublicCaptions(w.ports, { ...opts, includeOrphans: true });
    expect(swept.counts["orphan-deleted"]).toBe(1);
    expect(w.pub.size).toBe(0);
  });

  it("never deletes a public file whose private copy is missing or has a different size", async () => {
    const w = standard();
    await copyCaptionsToPrivate(w.ports, { apply: true });
    w.priv.set(`videos/${V1}/captions/pl-${sha(PL)}.vtt`, new Uint8Array(3)); // damaged copy
    const r = await deleteLegacyPublicCaptions(w.ports, opts);
    expect(r.counts).toMatchObject({ deleted: 1, "orphan-kept": 1 });
    expect(w.pub.has(keyPl)).toBe(true);
  });

  it("is idempotent: a second run has nothing left to delete", async () => {
    const w = standard();
    await copyCaptionsToPrivate(w.ports, { apply: true });
    await deleteLegacyPublicCaptions(w.ports, opts);
    const again = await deleteLegacyPublicCaptions(w.ports, opts);
    expect(again.items).toEqual([]);
  });
});
