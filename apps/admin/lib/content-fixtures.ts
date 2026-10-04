/**
 * Sample films for `next dev` WITHOUT a database (ADMIN_DEV_FIXTURES=1, never in production): layout work and
 * screenshots of the "Treści" screens. Relative to "now"; every write action refuses to run on them.
 */
import type { ContentDetail, ContentFilters, ContentListResult, LayoutItem, ThumbnailState } from "@/lib/modules/admin-content";
import type { AdminVideoDetailsDto } from "@/lib/modules/video";
import type { PipelineStateDto } from "@/lib/modules/video-pipeline";

const H = 3600_000;
const D = 24 * H;

type Seed = {
  slug: string;
  title: string;
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  tier: "PUBLIC" | "LOGGED_IN";
  hls: "READY" | "PROCESSING" | "FAILED" | "MISSING_SOURCE";
  thumb: ThumbnailState;
  views: number;
  ageDays: number;
  premiereInDays?: number;
  subsPl?: boolean;
  subsEn?: boolean;
  hero?: boolean;
  sidebar?: boolean;
  manualPercent?: number;
  goal?: number;
};

const OWN: ThumbnailState = { kind: "ok", label: "Własna", detail: "kopia publiczna aktualna" };
const SEEDS: Seed[] = [
  { slug: "czesc", title: "Cześć", status: "PUBLISHED", tier: "PUBLIC", hls: "READY", thumb: OWN, views: 1284, ageDays: 34, subsPl: true, hero: true, sidebar: true, goal: 200000 },
  { slug: "kulisy", title: "Kulisy montażu", status: "PUBLISHED", tier: "LOGGED_IN", hls: "READY", thumb: OWN, views: 0, ageDays: 3, premiereInDays: 2.3, subsPl: true, subsEn: true, sidebar: true, manualPercent: 65 },
  { slug: "jj", title: "JJ", status: "PUBLISHED", tier: "LOGGED_IN", hls: "READY", thumb: { kind: "warn", label: "Niezsynchr.", detail: "kopia publiczna nieaktualna; strona używa proxy do nocnej synchronizacji" }, views: 412, ageDays: 9, sidebar: true },
  { slug: "dla-patronow", title: "Dla patronów", status: "PUBLISHED", tier: "LOGGED_IN", hls: "READY", thumb: { kind: "info", label: "Stara (Blob)", detail: "miniatura z poprzedniego magazynu" }, views: 233, ageDays: 61, subsPl: true, sidebar: true },
  { slug: "qa-1", title: "Pytania od widzów #1", status: "DRAFT", tier: "PUBLIC", hls: "PROCESSING", thumb: { kind: "warn", label: "Domyślna", detail: "film nie ma własnej miniatury" }, views: 0, ageDays: 0.2 },
  { slug: "test-kodowania-4k", title: "Test kodowania 4K", status: "DRAFT", tier: "LOGGED_IN", hls: "FAILED", thumb: { kind: "warn", label: "Domyślna", detail: "film nie ma własnej miniatury" }, views: 0, ageDays: 1 },
  { slug: "stary-wywiad", title: "Stary wywiad (2025)", status: "ARCHIVED", tier: "PUBLIC", hls: "READY", thumb: OWN, views: 88, ageDays: 210 },
];

function toDetail(s: Seed, i: number, now: Date): ContentDetail {
  const created = new Date(now.getTime() - s.ageDays * D);
  const premiereAt = s.premiereInDays ? new Date(now.getTime() + s.premiereInDays * D) : null;
  const video = {
    id: `v-${s.slug}`,
    slug: s.slug,
    title: s.title,
    titleEn: s.subsEn ? `${s.title} (EN)` : null,
    description: `Opis filmu „${s.title}”.`,
    descriptionEn: null,
    thumbnailUrl: `/api/videos/v-${s.slug}/thumbnail`,
    subtitleUrlPl: s.subsPl ? `https://thumbs.example/videos/v-${s.slug}/subtitles/pl.vtt` : null,
    subtitleUrlEn: s.subsEn ? `https://thumbs.example/videos/v-${s.slug}/subtitles/en.vtt` : null,
    duration: null,
    tier: s.tier,
    views: s.views,
    likesCount: Math.round(s.views / 14),
    dislikesCount: Math.round(s.views / 200),
    publishedAt: s.status === "DRAFT" ? null : created,
    premiereAt: premiereAt?.toISOString() ?? null,
    isMainFeatured: !!s.hero,
    showInSidebar: !!s.sidebar,
    sidebarOrder: i,
    status: s.status,
    creatorId: "c-main",
    createdAt: created,
    updatedAt: new Date(created.getTime() + H),
    commentsCount: Math.round(s.views / 40),
    asset: null,
    assets: [],
    original: null,
    migrationStatus: s.hls,
    publishAfterAssetReady: s.slug === "qa-1",
    publishAfterAssetReadyProvider: null,
    publishAfterAssetReadyRequestedAt: null,
    publishAfterAssetReadyCompletedAt: null,
    publishAfterAssetReadyError: null,
    fundraisingGoalMinor: s.goal ?? null,
    fundraisingGoalCurrency: s.goal ? "PLN" : null,
    fundraisingStartAt: s.goal ? new Date(now.getTime() - 40 * D) : null,
    fundraisingManualPercent: s.manualPercent ?? null,
    diagnostics:
      s.hls === "FAILED"
        ? [{ severity: "ERROR", message: "Kodowanie nie powiodło się. Sprawdź błąd w zakładce Media.", field: "asset" }, { severity: "ERROR", code: "VIDEO_PUBLICATION_ASSET_NOT_READY", message: "Publikacja zablokowana: Wideo jest jeszcze kodowane albo kodowanie się nie powiodło.", field: "activePlaybackRoute" }]
        : s.hls === "PROCESSING"
          ? [{ severity: "WARNING", message: "Materiał jest w stanie: PROCESSING.", field: "asset" }, { severity: "WARNING", message: "Brak tytułu EN.", field: "titleEn" }]
          : s.subsEn
            ? []
            : [{ severity: "WARNING", message: "Brak tytułu EN.", field: "titleEn" }],
    auditLogs: [
      { id: `a1-${s.slug}`, action: "VIDEO_UPDATED", createdAt: new Date(now.getTime() - 2 * H), actorType: "admin", metadata: { changed: ["title", "description"] } },
      { id: `a2-${s.slug}`, action: "VIDEO_CREATED", createdAt: created, actorType: "admin", metadata: {} },
    ],
  } as unknown as AdminVideoDetailsDto;

  const pipeline: PipelineStateDto | null =
    s.hls === "MISSING_SOURCE"
      ? { summary: "NO_ORIGINAL", workerAlive: true, original: null, job: null, assets: [], hasCompetingSource: false }
      : {
          summary: s.hls === "READY" ? "READY" : s.hls === "PROCESSING" ? "ENCODING" : "FAILED",
          workerAlive: true,
          original: { id: `o-${s.slug}`, status: "READY", fileName: `${s.slug}-final.mov`, sizeBytes: String(4_512_000_000), version: 1, failureReason: null, uploadCompletedAt: new Date(created.getTime() + 20 * 60_000).toISOString() },
          job: {
            id: `j-${s.slug}`,
            status: s.hls === "READY" ? "SUCCEEDED" : s.hls === "PROCESSING" ? "RUNNING" : "FAILED",
            stage: s.hls === "READY" ? "DONE" : "ENCODING",
            progressPercent: s.hls === "READY" ? 100 : s.hls === "PROCESSING" ? 62 : 31,
            etaSeconds: s.hls === "PROCESSING" ? 250 : null,
            attemptCount: s.hls === "FAILED" ? 2 : 1,
            maxAttempts: 3,
            versionNumber: 1,
            originalId: `o-${s.slug}`,
            assetId: s.hls === "READY" ? `as-${s.slug}` : null,
            cancelRequested: false,
            failureCode: s.hls === "FAILED" ? "FFMPEG_EXIT_137" : null,
            failureReason: s.hls === "FAILED" ? "ffmpeg zakończony kodem 137 (brak pamięci)" : null,
            nextAttemptAt: null,
            createdAt: created.toISOString(),
            startedAt: created.toISOString(),
            finishedAt: s.hls === "PROCESSING" ? null : new Date(created.getTime() + 40 * 60_000).toISOString(),
            heartbeatFresh: s.hls === "PROCESSING",
          },
          assets: s.hls === "READY" ? [{ id: `as-${s.slug}`, objectKey: `videos/v-${s.slug}/v/v1/master.m3u8`, versionNumber: 1, isActive: true, sizeBytes: 2_380_000_000, createdAt: created.toISOString() }] : [],
          hasCompetingSource: false,
        };
  return { video, pipeline, thumb: s.thumb };
}

const all = (now = new Date()) => SEEDS.map((s, i) => toDetail(s, i, now));

export function fixtureList(filters: ContentFilters): ContentListResult {
  const q = filters.q?.toLowerCase().trim();
  const rows = all()
    .filter(({ video: v }) => (!q || `${v.title} ${v.slug}`.toLowerCase().includes(q)) && (!filters.status || v.status === filters.status) && (!filters.tier || v.tier === filters.tier) && (!filters.hls || v.migrationStatus === filters.hls))
    .sort((a, b) => (filters.sort === "title" ? a.video.title.localeCompare(b.video.title, "pl") : filters.sort === "views" ? b.video.views - a.video.views : new Date(b.video.createdAt).getTime() - new Date(a.video.createdAt).getTime()));
  return { items: rows.map((r) => r.video), total: rows.length, page: 1, totalPages: 1, thumbs: Object.fromEntries(rows.map((r) => [r.video.id, r.thumb!])) };
}

export function fixtureDetail(slug: string): ContentDetail | null {
  return all().find((d) => d.video.slug === slug || d.video.id === slug) ?? null;
}

export function fixtureLayout(): LayoutItem[] {
  return all()
    .filter((d) => d.video.status === "PUBLISHED")
    .map(({ video: v }) => ({ id: v.id, slug: v.slug, title: v.title, tier: v.tier, showInSidebar: v.showInSidebar, isMainFeatured: v.isMainFeatured, sidebarOrder: v.sidebarOrder, premiereAt: v.premiereAt ? new Date(v.premiereAt) : null }));
}
