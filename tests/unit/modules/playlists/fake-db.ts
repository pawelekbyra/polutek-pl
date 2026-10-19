import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";

/**
 * A tiny in-memory stand-in for the Prisma calls the playlist use cases make, with real transaction semantics
 * (a failing callback rolls every write back), so the tests can check atomicity and scoping without a database.
 */
export type FakeState = {
  channels: { id: string; userId: string; status: string; members: { userId: string; role: string }[] }[];
  videos: { id: string; creatorId: string }[];
  playlists: { id: string; channelId: string; title: string; description: string | null; visibility: string; slug: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null }[];
  items: { id: string; playlistId: string; videoId: string; position: number; addedAt: Date }[];
  audit: { action: string; targetId?: string | null; channelId?: string | null; metadata?: unknown }[];
};

export function emptyState(): FakeState {
  return {
    channels: [
      { id: "ch-1", userId: "owner-1", status: "ACTIVE", members: [{ userId: "editor-1", role: "EDITOR" }, { userId: "mod-1", role: "MODERATOR" }] },
      { id: "ch-2", userId: "owner-2", status: "ACTIVE", members: [] },
    ],
    videos: [
      { id: "v1", creatorId: "ch-1" },
      { id: "v2", creatorId: "ch-1" },
      { id: "v3", creatorId: "ch-1" },
      { id: "x1", creatorId: "ch-2" },
    ],
    playlists: [],
    items: [],
    audit: [],
  };
}

let counter = 0;

export function makeDb(state: FakeState, options: { failSetPositionAfter?: number } = {}) {
  let setPositionCalls = 0;
  const db: any = {
    creator: {
      findUnique: async ({ where }: any) => state.channels.find((c) => c.id === where.id) ?? null,
    },
    video: {
      findFirst: async ({ where }: any) => state.videos.find((v) => v.id === where.id && v.creatorId === where.creatorId) ?? null,
    },
    playlist: {
      findFirst: async ({ where }: any) =>
        state.playlists.find((p) => p.id === where.id && p.channelId === where.channelId && (where.deletedAt === null ? p.deletedAt === null : true)) ?? null,
      count: async ({ where }: any) => state.playlists.filter((p) => p.channelId === where.channelId && p.deletedAt === null).length,
      findMany: async ({ where }: any) => state.playlists.filter((p) => p.channelId === where.channelId && p.slug.startsWith(where.slug.startsWith)).map((p) => ({ slug: p.slug })),
      create: async ({ data }: any) => {
        if (state.playlists.some((p) => p.channelId === data.channelId && p.slug === data.slug)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: `pl-${++counter}`, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...data };
        state.playlists.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.playlists.find((p) => p.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    playlistItem: {
      findMany: async ({ where }: any) =>
        state.items
          .filter((i) => i.playlistId === where.playlistId)
          .sort((a, b) => a.position - b.position)
          .map((i) => ({ videoId: i.videoId, position: i.position })),
      aggregate: async ({ where }: any) => {
        const positions = state.items.filter((i) => i.playlistId === where.playlistId).map((i) => i.position);
        return { _max: { position: positions.length ? Math.max(...positions) : null } };
      },
      count: async ({ where }: any) => state.items.filter((i) => i.playlistId === where.playlistId).length,
      findUnique: async ({ where }: any) => {
        const key = where.playlistId_videoId;
        const row = state.items.find((i) => i.playlistId === key.playlistId && i.videoId === key.videoId);
        return row ? { id: row.id } : null;
      },
      create: async ({ data }: any) => {
        if (state.items.some((i) => i.playlistId === data.playlistId && i.videoId === data.videoId)) throw Object.assign(new Error("unique"), { code: "P2002" });
        state.items.push({ id: `it-${++counter}`, addedAt: new Date(), ...data });
        return data;
      },
      deleteMany: async ({ where }: any) => {
        const before = state.items.length;
        state.items = state.items.filter((i) => !(i.playlistId === where.playlistId && i.videoId === where.videoId));
        return { count: before - state.items.length };
      },
      update: async ({ where, data }: any) => {
        setPositionCalls += 1;
        if (options.failSetPositionAfter !== undefined && setPositionCalls > options.failSetPositionAfter) throw new Error("boom");
        const key = where.playlistId_videoId;
        Object.assign(state.items.find((i) => i.playlistId === key.playlistId && i.videoId === key.videoId)!, data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.audit.push({ action: data.action, targetId: data.targetId, channelId: data.channelId, metadata: data.metadata });
        return data;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = structuredClone({ playlists: state.playlists, items: state.items, audit: state.audit });
      try {
        return await fn(db);
      } catch (error) {
        state.playlists = snapshot.playlists;
        state.items = snapshot.items;
        state.audit = snapshot.audit;
        throw error;
      }
    },
  };
  return db;
}

export function makeCtx(state: FakeState, actor: Actor, options?: Parameters<typeof makeDb>[1]): AppContext {
  return createAppContext({ actor, prisma: makeDb(state, options), now: () => new Date("2026-10-19T12:00:00Z") });
}

export const owner: Actor = { type: "user", userId: "owner-1" };
export const editor: Actor = { type: "user", userId: "editor-1" };
export const moderator: Actor = { type: "user", userId: "mod-1" };
export const stranger: Actor = { type: "user", userId: "someone" };
export const otherOwner: Actor = { type: "user", userId: "owner-2" };
export const guest: Actor = { type: "guest" };
