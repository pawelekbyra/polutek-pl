import { prisma } from "@/lib/prisma";
import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";

async function main() {
  const jobId = process.env.K20_JOB_ID;
  if (!jobId) throw new Error("K20_JOB_ID is required");

  try {
    const job = await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: jobId } });
    await createSelfHlsFinalizer(prisma).finalize({
      job,
      assetKey: hlsAttemptAssetKey(job.videoId, job.versionNumber, job.attemptId, "master.m3u8"),
      hlsBucket: "k20-worker-process-test",
      posterPath: "/unused-k20-worker-poster.jpg",
      meta: { source: { durationSeconds: 30 } },
      totalBytes: 100,
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
