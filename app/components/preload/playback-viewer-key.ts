/**
 * Identity a cached playback plan belongs to. Plans are per viewer (they carry a delivery token
 * and a playback session), so a plan is only ever reused for exactly the viewer it was made for.
 * Shared by the browser preload cache and the server render that hands the home page its first
 * plan, so both name the same viewer the same way.
 */
export function resolvePlaybackViewerKey({
  isLoaded,
  userId,
  sessionId,
}: {
  isLoaded: boolean;
  userId: string | null | undefined;
  sessionId: string | null | undefined;
}): string | null {
  if (!isLoaded) return null;
  if (!userId) {
    return sessionId
      ? `anonymous-session:${encodeURIComponent(sessionId)}`
      : "anonymous";
  }
  if (!sessionId) return null;
  return `user:${encodeURIComponent(userId)}:session:${encodeURIComponent(sessionId)}`;
}
