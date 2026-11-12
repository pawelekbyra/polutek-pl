import { PrismaClient } from "@prisma/client";
import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";

async function main() {
  const jobId = process.env.K17_JOB_ID;
  const mode = process.env.K17_MODE;
  if (!jobId || !["stale", "current"].includes(mode ?? "")) throw new Error("K17_JOB_ID and K17_MODE are required");

  const prisma = new PrismaClient();
  try {
    const job = await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: jobId } });
    const finalize = () => createSelfHlsFinalizer(prisma).finalize({
      job,
      assetKey: hlsAttemptAssetKey(job.videoId, job.versionNumber, job.attemptId),
      hlsBucket: "k17-worker-process-test",
      posterPath: "/unused-k17-worker-poster.jpg",
      meta: { source: { durationSeconds: 30 } },
      totalBytes: 100,
    });

    if (mode === "stale") {
      try {
        await finalize();
      } catch (error) {
        if (error instanceof Error && error.message.includes("Encode attempt no longer owns this job")) {
          process.stdout.write("K17_STALE_ATTEMPT_REJECTED\n");
          return;
        }
        throw error;
      }
      throw new Error("Stale attempt unexpectedly finalized");
    }

    const result = await finalize();
    process.stdout.write(`K17_FINALIZED=${result.assetId}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
