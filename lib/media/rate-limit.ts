import { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/api/client-ip';

export function getMediaClientIp(req: NextRequest) {
  return getClientIp(req.headers);
}

export function buildMediaRateLimitKey({ userId, ip, mediaId }: { userId: string | null; ip: string; mediaId: string }) {
  const actor = userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
  return `media:${actor}:${mediaId}`;
}
