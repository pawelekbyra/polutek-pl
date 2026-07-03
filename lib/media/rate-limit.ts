import { NextRequest } from 'next/server';

export function getMediaClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    forwardedFor?.[forwardedFor.length - 1] ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export function buildMediaRateLimitKey({ userId, ip, mediaId }: { userId: string | null; ip: string; mediaId: string }) {
  const actor = userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
  return `media:${actor}:${mediaId}`;
}
