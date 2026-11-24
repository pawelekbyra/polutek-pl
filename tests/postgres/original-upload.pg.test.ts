/** K15 completion/replay race on the same Studio HTTP route and real PostgreSQL rows. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import { MultipartCompleteResponseSchema, MultipartStartResponseSchema, StudioPipelineStateResponseSchema } from "@/lib/video-api-contracts/contracts";

const mocks = vi.hoisted(() => ({
  sessions: new Map<string, unknown>(),
  resolveStudioSession: vi.fn(),
  storage: {
    bucket: "k15-test-originals",
    create: vi.fn(async () => "unused"),
    presignPart: vi.fn(async () => "unused"),
    listParts: vi.fn(async () => []),
    complete: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    head: vi.fn(async () => ({ exists: true, sizeBytes: 20 * 1024 * 1024 })),
    readHead: vi.fn(async () => Uint8Array.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0])),
    deleteObject: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/api/studio-session", () => ({
  resolveStudioSession: mocks.resolveStudioSession,
}));
vi.mock("@/lib/modules/video-pipeline/infrastructure/r2-multipart", () => ({
  OriginalsMultipart: { fromEnv: () => mocks.storage },
}));

import { POST as completeUpload } from "@/app/api/studio/videos/[id]/upload/complete/route";
import { POST as startUpload } from "@/app/api/studio/videos/[id]/upload/route";
import { GET as getPipeline } from "@/app/api/studio/videos/[id]/pipeline/route";

const prisma = new PrismaClient();
const RUN = `k15-${Date.now().toString(36)}`;
const FILE_SIZE = 20 * 1024 * 1024;
const PARTS = [{ partNumber: 1, etag: '"part-etag"' }];
let userId = "";
let creatorId = "";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function studioContext(user: string, channel: string): AppContext {
  return createAppContext({ actor: { type: "user", userId: user }, prisma, channelId: channel });
}

function registerSession(requestId: string, ctx: AppContext) {
  mocks.sessions.set(requestId, {
    ctx,
    userId,
    channel: { id: creatorId, slug: `${RUN}-creator`, handle: `${RUN}-creator`, name: "K15 test", status: "ACTIVE" },
    channels: [],
  });
}

async function makeVideo(slugSuffix: string) {
  const video = await prisma.video.create({
    data: { creatorId, title: "K15 race test", slug: `${RUN}-${slugSuffix}`, thumbnailUrl: "/logo.png" },
  });
  const v1 = await prisma.videoOriginal.create({
    data: {
      videoId: video.id, bucket: mocks.storage.bucket, objectKey: `originals/${video.id}/v1.mp4`, version: 1,
      status: "READY", sizeBytes: BigInt(FILE_SIZE), mimeType: "video/mp4", uploadCompletedAt: new Date(), verifiedAt: new Date(),
    },
  });
  await prisma.video.update({ where: { id: video.id }, data: { activeOriginalId: v1.id } });
  return { video, v1 };
}

async function post(videoId: string, originalId: string, requestId: string) {
  return completeUpload(
    new Request(`https://www.pawelperfect.com/api/studio/videos/${videoId}/upload/complete`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({ originalId, parts: PARTS }),
    }),
    { params: Promise.resolve({ id: videoId }) },
  );
}

async function getPipelineResponse(videoId: string, requestId: string) {
  return getPipeline(
    new Request(`https://www.pawelperfect.com/api/studio/videos/${videoId}/pipeline`, { headers: { "x-request-id": requestId } }),
    { params: Promise.resolve({ id: videoId }) },
  );
}

async function expectStatus(response: Response, status: number) {
  expect(response.status, await response.clone().text()).toBe(status);
}

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K15 test" } });
  creatorId = creator.id;
  mocks.resolveStudioSession.mockImplementation(({ requestId }: { requestId?: string }) => mocks.sessions.get(requestId ?? "") ?? null);
});

afterAll(async () => {
  await prisma.video.deleteMany({ where: { slug: { startsWith: `${RUN}-` } } });
  await prisma.creator.deleteMany({ where: { id: creatorId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("original upload monotonic completion on PostgreSQL and HTTP", () => {
  it("returns contract-compatible multipart and pipeline DTOs from real Studio routes and PostgreSQL", async () => {
    const { video } = await makeVideo("contract-route");
    registerSession("contract-start", studioContext(userId, creatorId));

    const started = await startUpload(
      new Request(`https://www.pawelperfect.com/api/studio/videos/${video.id}/upload`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "contract-start" },
        body: JSON.stringify({ fileName: "original.mp4", fileSize: FILE_SIZE, contentType: "video/mp4" }),
      }),
      { params: Promise.resolve({ id: video.id }) },
    );
    await expectStatus(started, 200);
    const startBody: unknown = await started.json();
    expect(MultipartStartResponseSchema.safeParse(startBody).success).toBe(true);

    const pipeline = await getPipelineResponse(video.id, "contract-start");
    await expectStatus(pipeline, 200);
    const pipelineBody: unknown = await pipeline.json();
    expect(StudioPipelineStateResponseSchema.safeParse(pipelineBody).success).toBe(true);
    expect(pipelineBody).toMatchObject({ summary: "UPLOADING", original: { status: "UPLOADING" }, job: null });
  });

  it("does not let a v1 READY retry reverse v2 after it was read", async () => {
    const { video, v1 } = await makeVideo("retry-race");
    const v2 = await prisma.videoOriginal.create({
      data: {
        videoId: video.id, bucket: mocks.storage.bucket, objectKey: `originals/${video.id}/v2.mp4`, version: 2,
        status: "UPLOADING", uploadId: "upload-v2", uploadPartSize: FILE_SIZE, uploadPartCount: 1,
        sizeBytes: BigInt(FILE_SIZE), mimeType: "video/mp4",
      },
    });

    const arrivedAtRetryTransaction = deferred();
    const resumeRetry = deferred();
    const staleCtx = studioContext(userId, creatorId);
    const realWriteTransaction = staleCtx.db.writeTransaction;
    staleCtx.db.writeTransaction = async (fn) => {
      arrivedAtRetryTransaction.resolve(); // the handler has already read v1 as READY
      await resumeRetry.promise;
      return realWriteTransaction(fn);
    };
    registerSession("stale-v1-retry", staleCtx);
    registerSession("complete-v2", studioContext(userId, creatorId));

    const staleRetry = post(video.id, v1.id, "stale-v1-retry");
    await arrivedAtRetryTransaction.promise;
    const v2Response = await post(video.id, v2.id, "complete-v2");
    await expectStatus(v2Response, 200);
    resumeRetry.resolve();
    const staleResponse = await staleRetry;

    await expectStatus(staleResponse, 409);
    expect(await staleResponse.json()).toMatchObject({ code: "UPLOAD_SUPERSEDED" });
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id }, select: { activeOriginalId: true } })).toEqual({ activeOriginalId: v2.id });
    expect(await prisma.videoOriginal.findUniqueOrThrow({ where: { id: v1.id }, select: { status: true } })).toEqual({ status: "SUPERSEDED" });
    expect(await prisma.videoOriginal.findUniqueOrThrow({ where: { id: v2.id }, select: { status: true } })).toEqual({ status: "READY" });
    expect(await prisma.videoEncodeJob.findMany({ where: { videoId: video.id }, select: { originalId: true } })).toEqual([{ originalId: v2.id }]);
  });

  it("repairs a READY original with a missing encode job and replay returns the same job", async () => {
    const { video, v1 } = await makeVideo("enqueue-repair");
    const context = studioContext(userId, creatorId);
    registerSession("repair-ready-gap", context);

    const first = await post(video.id, v1.id, "repair-ready-gap");
    await expectStatus(first, 200);
    const firstBody: unknown = await first.json();
    expect(MultipartCompleteResponseSchema.safeParse(firstBody).success).toBe(true);
    const firstJobId = (firstBody as { job: { id: string } }).job.id;
    const replay = await post(video.id, v1.id, "repair-ready-gap");
    await expectStatus(replay, 200);
    expect(await replay.json()).toMatchObject({ job: { id: firstJobId } });
    const pipeline = await getPipelineResponse(video.id, "repair-ready-gap");
    await expectStatus(pipeline, 200);
    const pipelineBody: unknown = await pipeline.json();
    expect(StudioPipelineStateResponseSchema.safeParse(pipelineBody).success).toBe(true);
    expect(pipelineBody).toMatchObject({ summary: "QUEUED", job: { id: firstJobId, status: "QUEUED" } });
    expect(await prisma.videoEncodeJob.count({ where: { videoId: video.id, originalId: v1.id } })).toBe(1);
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id }, select: { activeOriginalId: true } })).toEqual({ activeOriginalId: v1.id });
  });

  it("supersedes an older upload that finishes after a newer READY version", async () => {
    const { video, v1 } = await makeVideo("late-upload");
    await prisma.videoOriginal.update({
      where: { id: v1.id },
      data: { status: "UPLOADING", uploadId: "upload-v1", uploadPartSize: FILE_SIZE, uploadPartCount: 1 },
    });
    const v2 = await prisma.videoOriginal.create({
      data: {
        videoId: video.id, bucket: mocks.storage.bucket, objectKey: `originals/${video.id}/v2.mp4`, version: 2,
        status: "READY", sizeBytes: BigInt(FILE_SIZE), mimeType: "video/mp4", uploadCompletedAt: new Date(), verifiedAt: new Date(),
      },
    });
    await prisma.video.update({ where: { id: video.id }, data: { activeOriginalId: v2.id } });
    mocks.storage.deleteObject.mockClear();
    registerSession("late-v1-upload", studioContext(userId, creatorId));

    const response = await post(video.id, v1.id, "late-v1-upload");

    await expectStatus(response, 409);
    expect(await response.json()).toMatchObject({ code: "UPLOAD_SUPERSEDED" });
    expect(mocks.storage.deleteObject).toHaveBeenCalledWith(v1.objectKey);
    expect(await prisma.videoOriginal.findUniqueOrThrow({ where: { id: v1.id }, select: { status: true, uploadId: true } })).toEqual({ status: "SUPERSEDED", uploadId: null });
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id }, select: { activeOriginalId: true } })).toEqual({ activeOriginalId: v2.id });
    expect(await prisma.videoEncodeJob.count({ where: { videoId: video.id } })).toBe(0);
  });
});
