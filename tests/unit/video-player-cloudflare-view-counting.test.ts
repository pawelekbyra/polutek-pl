import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync('app/components/VideoPlayer.tsx', 'utf8');

describe('VideoPlayer Cloudflare view counting path', () => {
  it('does not contain an iframe-load timer path for WATCHED_10_SECONDS', () => {
    const player = source();

    expect(player).not.toContain('cloudflare-iframe-fallback');
    expect(player).not.toContain('cloudflareViewFallbackTimer');
    expect(player).not.toContain('scheduleCloudflareViewFallback');
    expect(player).not.toContain('sendWatched10Seconds');
    expect(player).not.toMatch(/<iframe[\s\S]*WATCHED_10_SECONDS/);
    expect(player).not.toMatch(/onLoad=\{[\s\S]*WATCHED_10_SECONDS/);
  });

  it('keeps failed view-count requests retryable by separating in-flight and counted flags', () => {
    const player = source();
    const maybeSendViewStart = player.indexOf('const maybeSendView = useCallback');
    const maybeSendViewEnd = player.indexOf('}, [onViewCounted, sendEvent]);', maybeSendViewStart);
    const maybeSendView = player.slice(maybeSendViewStart, maybeSendViewEnd);

    expect(player).toContain('const viewCountRequestInFlight = useRef(false);');
    expect(maybeSendView).toContain('viewCountRequestInFlight.current');
    expect(maybeSendView).not.toMatch(/hasReached10s\.current\s*=\s*true;[\s\S]*sendEvent\('WATCHED_10_SECONDS'/);
    expect(maybeSendView).toMatch(/if \(result\.ok\) \{\s*hasReached10s\.current = true;/);
    expect(maybeSendView).toContain('viewCountRequestInFlight.current = false;');
  });
});
