import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCorrelationId } from "@/lib/utils/correlation";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoRepository } from "@/lib/modules/video/infrastructure/video.repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

      const poll = async () => {
        try {
          const mainChannel = await MainChannelService.getRequired(ctx);
          const repo = new VideoRepository(ctx.prisma);
          const video = await repo.findByIdWithAssets(videoId);

          if (!video || (video as any).creatorId !== mainChannel.id) {
            send("error", { code: "NOT_FOUND" });
            closed = true;
            controller.close();
            return;
          }

          const original = await ctx.prisma.videoOriginal.findUnique({ where: { videoId } });
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

          // Stop polling when everything is settled
          const allSettled = assets.every((a: any) =>
            a.processingState === "READY" || a.processingState === "FAILED"
          );
          const originalSettled = !original || original.status === "READY" || original.status === "FAILED";

          if (allSettled && originalSettled && assets.length > 0) {
            send("done", { videoId });
            closed = true;
            controller.close();
            return;
          }
        } catch (err) {
          console.error("SSE poll error", err);
        }
      };

      // Initial snapshot immediately
      await poll();

      if (closed) return;

      // Poll every 4 seconds
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        await poll();
      }, 4000);

      // Keepalive ping every 20s
      const ping = setInterval(() => {
        if (closed) {
          clearInterval(ping);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
          clearInterval(ping);
        }
      }, 20000);

      // Stop after 10 min max
      setTimeout(() => {
        clearInterval(interval);
        clearInterval(ping);
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      }, 600_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(ping);
        try { controller.close(); } catch {}
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
