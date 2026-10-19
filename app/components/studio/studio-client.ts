/**
 * Browser-side client of the Studio API (`/api/studio/*`). Every call is same-origin with the session cookie;
 * errors carry the server's message and code so the UI can show them as they are.
 */

export class StudioApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "StudioApiError";
  }
}

export type StudioFetch = typeof fetch;

export async function studioApi<T>(path: string, init: RequestInit = {}, fetchImpl: StudioFetch = fetch): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetchImpl(path, { ...init, headers, credentials: "same-origin" });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const e = body as { error?: string; code?: string } | null;
    throw new StudioApiError(e?.error ?? "Nie udało się wykonać operacji.", response.status, e?.code);
  }
  return body as T;
}

export const jsonBody = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });

// --- Types of what the API returns (the parts the UI uses) -------------------------------------------------

export interface StudioChannel {
  id: string;
  slug: string;
  handle: string | null;
  name: string;
  status: string;
  isVerified: boolean;
  bio?: string | null;
  language: string | null;
  country: string | null;
}

/** The current channel's upload limits (read only); `null` when the channel has none of its own. */
export interface StudioLimits {
  maxVideoSeconds: number;
  maxUploadBytes: number;
  maxUploadsPerDay: number;
}

export interface StudioMe {
  channel: StudioChannel | null;
  channels: StudioChannel[];
  channelCreation: "off" | "invite" | "on";
  /** This account may create a channel now (gate on, or invited). False for an account that already has one. */
  canCreateChannel?: boolean;
  limits?: StudioLimits | null;
}

export interface StudioVideo {
  id: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "UNLISTED" | "ARCHIVED";
  tier: "PUBLIC" | "LOGGED_IN";
  thumbnailUrl: string | null;
  premiereAt: string | null;
  views: number;
  createdAt: string;
  /** Changes with every save (also a new cover); used to bust the browser cache of the thumbnail. */
  updatedAt?: string | null;
  publishedAt: string | null;
  commentsCount?: number;
  /** Set when the video publishes itself once processing is done. */
  publishAfterAssetReady?: boolean;
  /** Creator metadata (lib/video-metadata.ts). */
  tags?: string[];
  category?: string | null;
  commentsMode?: "ON" | "HELD" | "OFF";
  /** Creator's 18+ declaration. */
  isAdult?: boolean;
}

export interface StudioVideoList {
  items: StudioVideo[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StudioComment {
  id: string;
  text: string | null;
  status: "VISIBLE" | "HELD_FOR_REVIEW" | "HIDDEN" | "DELETED";
  createdAt: string;
  parentId: string | null;
  isHearted: boolean;
  isPinned: boolean;
  creatorReplied: boolean;
  reportsCount: number;
  video: { id: string; title: string; slug: string } | null;
  author: { id: string; name: string } | null;
}

export interface StudioCommentList {
  items: StudioComment[];
  total: number;
  page: number;
  totalPages: number;
  counts: { comments: number; held: number; pendingReports: number } | null;
}

export interface PipelineSummaryState {
  /** Opaque summary string from the server (queued, encoding, ready, failed...). */
  summary?: unknown;
  [key: string]: unknown;
}

/**
 * The image address for a video card: the DTO's `thumbnailUrl` (proxy path or public bucket URL) or the proxy path,
 * with `?v=<updatedAt>` so a freshly uploaded cover shows up instead of the cached previous one.
 */
export function studioThumbnailSrc(video: Pick<StudioVideo, "id" | "thumbnailUrl" | "updatedAt">): string {
  const src = video.thumbnailUrl || `/api/videos/${encodeURIComponent(video.id)}/thumbnail`;
  if (!video.updatedAt) return src;
  const stamp = Date.parse(video.updatedAt);
  if (Number.isNaN(stamp)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}v=${stamp}`;
}
