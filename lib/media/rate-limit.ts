import { NextRequest } from 'next/server';

export function getMediaClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export function buildMediaRateLimitKey({ userId, ip, mediaId }: { userId: string | null; ip: string; mediaId: string }) {
  const actor = userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
  return `media:${actor}:${mediaId}`;
}
