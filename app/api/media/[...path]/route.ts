import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGatedBlobResponse } from '@/lib/blob';
import { rateLimit } from '@/lib/rate-limit';
import { buildMediaRateLimitKey, getMediaClientIp } from '@/lib/media/rate-limit';
import { RateLimitConfigurationError, resolveRedisRestEnv } from '@/lib/rate-limit';

function rateLimitedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'RATE_LIMITED',
      message: 'Za dużo żądań. Spróbuj ponownie za chwilę.',
    },
    { status: 429 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
  const { userId } = await auth();

  // Extract videoId from the path params instead of searchParams for cleaner /api/media/[videoId] pattern
  // path[0] will be the videoId if called as /api/media/VIDEO_ID
  const videoId = params.path[0];

  if (!videoId) {
    return NextResponse.json({ error: 'Bad Request: videoId is required' }, { status: 400 });
  }

  const mediaRateLimit = await rateLimit({
    key: buildMediaRateLimitKey({ userId, ip: getMediaClientIp(req), mediaId: videoId }),
    limit: 240,
    windowMs: 60_000,
  });

  if (!mediaRateLimit.success) {
    return rateLimitedResponse();
  }

  // Securely stream the gated content from configured media storage.
  // getGatedBlobResponse handles DB lookup, AccessPolicy and whitelist.
  return getGatedBlobResponse(userId, videoId, req.headers);
  } catch (error: unknown) {
    if (error instanceof RateLimitConfigurationError) {
        const { missing } = resolveRedisRestEnv();
        console.error("[RATE_LIMIT_CONFIG_ERROR]", {
            route: "/api/media/[...path]",
            missing,
        });
        return NextResponse.json(
            {
                error: "SERVICE_CONFIGURATION_ERROR",
                message: "Odtwarzanie materiału jest chwilowo niedostępne."
            },
            { status: 503 }
        );
    }
    throw error;
  }
}
