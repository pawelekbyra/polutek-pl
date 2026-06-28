import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoRepository } from "@/lib/modules/video/infrastructure/video.repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Keep under Vercel's 60s default / 300s Pro limit
const MAX_STREAM_MS = 270_000;

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("STREAM_VIDEO_STATUS");
  if (response) return response;

  const videoId = params.id;
  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId! }, requestId: getCorrelationId() ?? undefined });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      // Resolve channel + ownership once before polling loop
      const mainChannel = await MainChannelService.getRequired(ctx);
      const repo = new VideoRepository(ctx.prisma);

      const initialVideo = await repo.findByIdForMainChannel(videoId, mainChannel.id);
      if (!initialVideo) {
        send("error", { code: "NOT_FOUND" });
        close();
        return;
      }

      let pollRunning = false;

      const poll = async () => {
        if (closed || pollRunning) return;
        pollRunning = true;
        try {
          const [video, original] = await Promise.all([
            repo.findByIdWithAssets(videoId),
            ctx.prisma.videoOriginal.findUnique({ where: { videoId } }),
          ]);

          if (!video) {
            send("error", { code: "NOT_FOUND" });
            close();
            return;
          }

          const assets = ((video as any).assets ?? []).map((a: any) => ({
            id: a.id,
            provider: a.provider,
            processingState: a.processingState,
            isPrimary: a.isPrimary,
            fallbackPriority: a.fallbackPriority,
            mirrorRequestedAt: a.mirrorRequestedAt,
            mirrorCompletedAt: a.mirrorCompletedAt,
            mirrorFailureReason: a.mirrorFailureReason,
            failureReason: a.failureReason,
          }));

          send("status", {
            videoId,
            original: original
              ? {
                  id: original.id,
                  status: original.status,
                  objectKey: original.objectKey,
                  sizeBytes: original.sizeBytes?.toString() ?? null,
                  uploadCompletedAt: original.uploadCompletedAt,
                }
              : null,
            assets,
          });

          const originalSettled = !original || original.status === "READY" || original.status === "FAILED";
          const assetsSettled = assets.length > 0 && assets.every((a: any) =>
            a.processingState === "READY" || a.processingState === "FAILED"
          );

          if (originalSettled && assetsSettled) {
            send("done", { videoId });
            close();
          }
        } catch (err) {
          console.error("SSE poll error", err);
        } finally {
          pollRunning = false;
        }
      };

      // Initial snapshot
      await poll();
      if (closed) return;

      // Self-scheduling poll — waits for previous to finish before next tick
      let pollTimeout: ReturnType<typeof setTimeout>;
      const schedulePoll = () => {
        if (closed) return;
        pollTimeout = setTimeout(async () => {
          await poll();
          schedulePoll();
        }, 4000);
      };
      schedulePoll();

      // Keepalive ping every 15s (under common proxy idle timeouts)
      const ping = setInterval(() => {
        if (closed) { clearInterval(ping); return; }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
          clearInterval(ping);
        }
      }, 15000);

      // Hard stop respecting Vercel limits
      const maxTimeout = setTimeout(() => {
        clearInterval(ping);
        clearTimeout(pollTimeout);
        close();
      }, MAX_STREAM_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        clearTimeout(pollTimeout);
        clearTimeout(maxTimeout);
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
