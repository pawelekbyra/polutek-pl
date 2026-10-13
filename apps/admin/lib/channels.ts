/**
 * Data of the "Kanały" screens: the channel module read models with the panel admin as actor. Errors surface as
 * exceptions so the segment error page shows them, never an empty list that looks like "no data".
 */
import type { ChannelStatus, ContentReportStatus } from "@prisma/client";
import { getChannelForStaff, listChannelsForStaff, listContentReports, type StaffChannelDetail, type StaffChannelList } from "@/lib/modules/channel";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { isDevFixturesEnabled } from "./config";

export const CHANNELS_PAGE_SIZE = 25;
const readCtx = () => createAppContext({ actor: { type: "admin", userId: "panel-read" } });

export const CHANNEL_STATUS: Record<string, { kind: "ok" | "warn" | "crit" | "info" | ""; label: string }> = {
  PENDING_REVIEW: { kind: "info", label: "Czeka na akceptację" },
  ACTIVE: { kind: "ok", label: "Aktywny" },
  LIMITED: { kind: "warn", label: "Ograniczony" },
  SUSPENDED: { kind: "crit", label: "Zawieszony" },
  BANNED: { kind: "crit", label: "Zablokowany" },
  DELETED: { kind: "", label: "Usunięty" },
};

export const REPORT_TARGET: Record<string, string> = { VIDEO: "film", CHANNEL: "kanał", COMMENT: "komentarz" };

const emptyList = (): StaffChannelList => ({ items: [], total: 0, page: 1, pageSize: CHANNELS_PAGE_SIZE, totalPages: 0 });

function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw r.error instanceof Error ? r.error : new Error((r.error as { message?: string })?.message ?? "Nie udało się wczytać danych.");
  return r.data;
}

export async function loadChannels(f: { q?: string; status?: string; page: number }): Promise<StaffChannelList> {
  if (isDevFixturesEnabled()) return emptyList();
  const status = f.status && f.status in CHANNEL_STATUS ? (f.status as ChannelStatus) : undefined;
  return unwrap(await listChannelsForStaff(readCtx(), { q: f.q, status, page: f.page, pageSize: CHANNELS_PAGE_SIZE }));
}

export async function loadChannel(id: string): Promise<StaffChannelDetail | null> {
  if (isDevFixturesEnabled()) return null;
  const res = await getChannelForStaff(readCtx(), id);
  if (!res.ok) {
    if ((res.error as { statusCode?: number }).statusCode === 404) return null;
    throw res.error;
  }
  return res.data;
}

export async function loadReports(f: { status: ContentReportStatus | undefined; channelId?: string; page: number }) {
  if (isDevFixturesEnabled()) return { items: [], total: 0, page: 1, pageSize: CHANNELS_PAGE_SIZE, totalPages: 0 };
  return unwrap(await listContentReports(readCtx(), { status: f.status, channelId: f.channelId, page: f.page, pageSize: CHANNELS_PAGE_SIZE }));
}
