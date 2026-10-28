import { describe, expect, it } from 'vitest';
import {
  isAdultVideo,
  isAllowedStatusTransition,
  isLinkAccessibleStatus,
  isListedStatus,
  shouldNoIndexVideo,
} from '@/lib/modules/video/domain/video-visibility';
import { VideoPolicy } from '@/lib/modules/video/domain/video.policy';
import { parseReadyVisibility, readyVisibilityKey } from '@/lib/modules/video/application/ready-visibility';

describe('video visibility rules', () => {
  it('only PUBLISHED is listed; PUBLISHED and UNLISTED are reachable by link', () => {
    expect(isListedStatus('PUBLISHED')).toBe(true);
    for (const status of ['UNLISTED', 'DRAFT', 'ARCHIVED', null, undefined]) {
      expect(isListedStatus(status as string)).toBe(false);
    }
    expect(isLinkAccessibleStatus('PUBLISHED')).toBe(true);
    expect(isLinkAccessibleStatus('UNLISTED')).toBe(true);
    expect(isLinkAccessibleStatus('DRAFT')).toBe(false);
    expect(isLinkAccessibleStatus('ARCHIVED')).toBe(false);
  });

  it('adult = creator declaration or AGE_RESTRICTED moderation', () => {
    expect(isAdultVideo({ isAdult: true })).toBe(true);
    expect(isAdultVideo({ moderationStatus: 'AGE_RESTRICTED' })).toBe(true);
    expect(isAdultVideo({ isAdult: false, moderationStatus: 'VISIBLE' })).toBe(false);
    expect(isAdultVideo({})).toBe(false);
  });

  it('unlisted and adult pages are noindex; a normal published video is not', () => {
    expect(shouldNoIndexVideo({ status: 'UNLISTED' })).toBe(true);
    expect(shouldNoIndexVideo({ status: 'PUBLISHED', isAdult: true })).toBe(true);
    expect(shouldNoIndexVideo({ status: 'PUBLISHED', moderationStatus: 'AGE_RESTRICTED' })).toBe(true);
    expect(shouldNoIndexVideo({ status: 'PUBLISHED' })).toBe(false);
    expect(shouldNoIndexVideo(null)).toBe(false);
  });
});

describe('status transitions', () => {
  it('allows PUBLISHED <-> UNLISTED <-> DRAFT in every direction', () => {
    const pairs: [string, string][] = [
      ['DRAFT', 'PUBLISHED'], ['DRAFT', 'UNLISTED'],
      ['PUBLISHED', 'UNLISTED'], ['UNLISTED', 'PUBLISHED'],
      ['PUBLISHED', 'DRAFT'], ['UNLISTED', 'DRAFT'],
    ];
    for (const [from, to] of pairs) expect(isAllowedStatusTransition(from, to), `${from} -> ${to}`).toBe(true);
  });

  it('archives from anywhere live and restores only to DRAFT', () => {
    for (const from of ['DRAFT', 'PUBLISHED', 'UNLISTED']) expect(isAllowedStatusTransition(from, 'ARCHIVED')).toBe(true);
    expect(isAllowedStatusTransition('ARCHIVED', 'DRAFT')).toBe(true);
    expect(isAllowedStatusTransition('ARCHIVED', 'PUBLISHED')).toBe(false);
    expect(isAllowedStatusTransition('ARCHIVED', 'UNLISTED')).toBe(false);
  });

  it('treats unknown statuses as not allowed', () => {
    expect(isAllowedStatusTransition('DRAFT', 'NOPE')).toBe(false);
    expect(isAllowedStatusTransition('NOPE', 'DRAFT')).toBe(false);
  });
});

describe('VideoPolicy for UNLISTED', () => {
  const route = { asset: { provider: 'SELF_HLS', processingState: 'READY', objectKey: 'videos/v1/v/v1' } };
  const draft = { title: 'T', slug: 's', tier: 'PUBLIC' as const, status: 'DRAFT' as const, activePlaybackRoute: route };

  it('unlisting has exactly the publication blockers', () => {
    expect(VideoPolicy.getUnlistBlockers(draft)).toEqual([]);
    const notReady = { ...draft, activePlaybackRoute: { asset: { ...route.asset, processingState: 'PROCESSING' } } };
    expect(VideoPolicy.getUnlistBlockers(notReady)).toEqual(VideoPolicy.getPublicationBlockers(notReady));
    expect(VideoPolicy.getUnlistBlockers(notReady).map((b) => b.code)).toContain('VIDEO_PUBLICATION_ASSET_NOT_READY');
    expect(VideoPolicy.getUnlistBlockers({ ...draft, activePlaybackRoute: null }).map((b) => b.code)).toContain('VIDEO_PUBLICATION_MISSING_ACTIVE_ROUTE');
  });

  it('an archived video cannot be unlisted before it is restored', () => {
    expect(VideoPolicy.getUnlistBlockers({ ...draft, status: 'ARCHIVED' }).map((b) => b.code)).toContain('VIDEO_PUBLICATION_ARCHIVED');
  });

  it('an unlisted video cannot be hero or sit in the sidebar (public slots are for PUBLISHED)', () => {
    const unlisted = { ...draft, status: 'UNLISTED' as const };
    expect(VideoPolicy.canBeHero(unlisted)).toBe(false);
    expect(VideoPolicy.getSidebarBlockers({ status: 'UNLISTED' }).map((b) => b.code)).toEqual(['VIDEO_SIDEBAR_NOT_PUBLISHED']);
    expect(VideoPolicy.isPubliclyVisible({ status: 'UNLISTED', publishedAt: new Date(0) } as never, new Date())).toBe(false);
  });

  it('the public list where-clause stays PUBLISHED only', () => {
    expect(VideoPolicy.buildPublicWhere('c1', new Date())).toMatchObject({ status: 'PUBLISHED' });
  });
});

describe('ready visibility setting', () => {
  it('never defaults to PUBLISHED: only the two known values parse, anything else is unknown', () => {
    expect(parseReadyVisibility(undefined)).toBeNull();
    expect(parseReadyVisibility(null)).toBeNull();
    expect(parseReadyVisibility('garbage')).toBeNull();
    expect(parseReadyVisibility('PUBLISHED')).toBe('PUBLISHED');
    expect(parseReadyVisibility('UNLISTED')).toBe('UNLISTED');
    expect(readyVisibilityKey('v1')).toBe('video_ready_visibility:v1');
  });
});
