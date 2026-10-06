/**
 * Replaces the source file of an existing video through the SAME use cases the admin panel uses
 * (multipart upload to R2, verification, encode job). Run inside the encoder container:
 *   npx tsx scripts/ops/replace-video-source.ts <videoId> <file> [--keep-thumbnail]
 * Unless --keep-thumbnail is given, the cover is reset to the default so the worker makes a new one from the poster frame.
 */
import { open, stat } from "node:fs/promises";
import { basename } from "node:path";
import { prisma } from "@/lib/prisma";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { startOriginalUpload, presignOriginalParts, completeOriginalMultipart } from "@/lib/modules/video-pipeline/application/original-upload.use-cases";

const [videoId, file, ...flags] = process.argv.slice(2);
if (!videoId || !file) throw new Error("usage: replace-video-source.ts <videoId> <file> [--keep-thumbnail]");

async function main() {
  const owner = await prisma.adminUser.findFirstOrThrow({ where: { role: "OWNER" }, select: { id: true } });
  const ctx = createAppContext({ type: "admin", userId: owner.id } as never);
  const size = (await stat(file)).size;
  const contentType = file.endsWith(".webm") ? "video/webm" : "video/mp4";

  const started = await startOriginalUpload({ videoId, fileName: basename(file), fileSize: size, contentType }, ctx);
  if (!started.ok) throw started.error;
  const { originalId, partSize, partCount } = started.data;

  const handle = await open(file, "r");
  const parts: Array<{ partNumber: number; etag: string }> = [];
  for (let n = 1; n <= partCount; n++) {
    const signed = await presignOriginalParts({ videoId, originalId, partNumbers: [n] }, ctx);
    if (!signed.ok) throw signed.error;
    const length = Math.min(partSize, size - (n - 1) * partSize);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, (n - 1) * partSize);
    const response = await fetch(signed.data.urls[0].url, { method: "PUT", body: buffer });
    if (!response.ok) throw new Error(`part ${n} failed: HTTP ${response.status}`);
    parts.push({ partNumber: n, etag: response.headers.get("etag") ?? "" });
  }
  await handle.close();

  if (!flags.includes("--keep-thumbnail")) await prisma.video.update({ where: { id: videoId }, data: { thumbnailUrl: "/logo.png" } });
  const done = await completeOriginalMultipart({ videoId, originalId, parts }, ctx);
  if (!done.ok) throw done.error;
  console.log(JSON.stringify({ videoId, originalId, jobId: done.data.job.id, status: done.data.job.status }));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
