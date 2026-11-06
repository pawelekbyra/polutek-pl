/** K25 exercises playlist count mutations through Prisma transactions on PostgreSQL. */
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createPlaylist, deletePlaylist } from "@/lib/modules/playlists/application/playlist-manage.use-cases";
import { PlaylistRepository } from "@/lib/modules/playlists/infrastructure/playlist.repository";

vi.mock("@/lib/modules/authz", () => ({ authorize: vi.fn(async () => null) }));

const prisma = new PrismaClient();
const RUN = `k25-${Date.now().toString(36)}`;
const userIds: string[] = [];
const channelIds: string[] = [];
let fixtureBatch = 0;
const PROCESS_TIMEOUT_MS = 30_000;

beforeAll(async () => {
  for (let index = 0; index < 2; index += 1) {
    const user = await prisma.user.create({ data: { id: `${RUN}-user-${index}`, email: `${RUN}-${index}@example.test` } });
    userIds.push(user.id);
    const channel = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-channel-${index}`, name: `K25 channel ${index}` } });
    channelIds.push(channel.id);
  }
});

afterAll(async () => {
  // AuditLog is append-only; this suite uses a disposable database that is dropped after it exits.
  await prisma.$disconnect();
});

function ctx(channelIndex: number) {
  return createAppContext({
    actor: { type: "user", userId: userIds[channelIndex]! },
    prisma,
    now: () => new Date(),
  });
}

async function addFixtures(channelIndex: number, count: number) {
  const batch = fixtureBatch++;
  const rows = await Promise.all(Array.from({ length: count }, (_, index) => prisma.playlist.create({
    data: {
      channelId: channelIds[channelIndex]!, title: `Existing ${batch}-${index}`, slug: `existing-${batch}-${index}`,
      visibility: "PRIVATE",
    },
    select: { id: true },
  })));
  return rows.map((row) => row.id);
}

function createPlaylistInProcess(channelId: string, userId: string, title: string): Promise<{ ok: true; id: string } | { ok: false; code: string; statusCode: number }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for K25 separate-process PostgreSQL test");
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || databaseUrl,
    K25_CHANNEL_ID: channelId,
    K25_USER_ID: userId,
    K25_TITLE: title,
  };
  const child = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
    path.join(process.cwd(), "tests/helpers/k25-create-playlist-process.ts"),
  ], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`K25 child process timed out: ${title}`));
    }, PROCESS_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`K25 child process failed (${code}): ${stderr.slice(-800)}`));
      try {
        resolve(JSON.parse(stdout) as { ok: true; id: string } | { ok: false; code: string; statusCode: number });
      } catch {
        reject(new Error(`K25 child process returned invalid JSON: ${stdout.slice(-800)}`));
      }
    });
  });
}

describe("K25 playlist limit concurrency (PostgreSQL)", () => {
  it("allows only one of two separate Node processes at 99 active playlists", async () => {
    await addFixtures(0, 99);

    try {
      const results = await Promise.all([
        createPlaylistInProcess(channelIds[0]!, userIds[0]!, "Concurrent Alpha"),
        createPlaylistInProcess(channelIds[0]!, userIds[0]!, "Concurrent Beta"),
      ]);
      const successes = results.filter((result) => result.ok);
      const refusals = results.filter((result) => !result.ok);

      expect(successes).toHaveLength(1);
      expect(refusals).toHaveLength(1);
      expect(refusals[0]).toMatchObject({ ok: false, code: "PLAYLIST_LIMIT", statusCode: 409 });
      expect(await prisma.playlist.count({ where: { channelId: channelIds[0], deletedAt: null } })).toBe(100);
      expect(await prisma.auditLog.count({ where: { action: "PLAYLIST_CREATED", targetId: successes[0]!.id } })).toBe(1);
    } finally {
      await prisma.playlist.updateMany({ where: { channelId: channelIds[0], deletedAt: null }, data: { deletedAt: new Date() } });
    }
  });

  it("frees a slot on soft delete, rejects a foreign channel id, and does not serialize another channel", async () => {
    const playlistIds = await addFixtures(0, 100);
    const foreignDelete = await deletePlaylist(ctx(1), { channelId: channelIds[1]!, playlistId: playlistIds[0]! });
    expect(foreignDelete).toMatchObject({ ok: false, error: { code: "NOT_FOUND", statusCode: 404 } });

    const deleted = await deletePlaylist(ctx(0), { channelId: channelIds[0]!, playlistId: playlistIds[0]! });
    expect(deleted).toMatchObject({ ok: true });
    const replacement = await createPlaylist(ctx(0), { channelId: channelIds[0]!, title: "Replacement" });
    expect(replacement.ok).toBe(true);
    expect(await prisma.playlist.count({ where: { channelId: channelIds[0], deletedAt: null } })).toBe(100);
    if (replacement.ok) {
      expect(await prisma.auditLog.count({ where: { action: "PLAYLIST_CREATED", targetId: replacement.data.id } })).toBe(1);
    }

    let releaseLock!: () => void;
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const hold = new Promise<void>((resolve) => { releaseLock = resolve; });
    const lockTransaction = prisma.$transaction(async (tx) => {
      await new PlaylistRepository(tx).lockChannelWrites(channelIds[0]!);
      signalLocked();
      await hold;
    });
    await locked;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const otherChannelWrite = createPlaylist(ctx(1), { channelId: channelIds[1]!, title: "Independent channel" });
    const result = await Promise.race([
      otherChannelWrite,
      new Promise<"blocked">((resolve) => { timer = setTimeout(() => resolve("blocked"), 1500); }),
    ]);
    releaseLock();
    if (timer) clearTimeout(timer);
    await lockTransaction;
    expect(result).not.toBe("blocked");
    expect(result).toMatchObject({ ok: true });
  });
});
