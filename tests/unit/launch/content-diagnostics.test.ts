import { describe, expect, it } from 'vitest';
import { runLaunchContentDiagnostics } from '@/lib/launch/content-diagnostics';

function productionEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@example.test/db',
    DATABASE_URL_UNPOOLED: 'postgresql://user:pass@example.test/db',
    NEXT_PUBLIC_APP_URL: 'https://polutek.pl',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_test',
    CLERK_SECRET_KEY: 'sk_live_test',
    CLERK_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_SECRET_KEY: 'sk_live_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_test',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'Polutek <noreply@polutek.pl>',
    ADMIN_CLERK_USER_IDS: 'admin_1',
    REFERRAL_PATRON_THRESHOLD: '10',
    HEALTHCHECK_TOKEN: 'token',
    EMAIL_UNSUBSCRIBE_SIGNING_SECRET: 'x'.repeat(32),
    MEDIA_BUCKET_HOST: 'media.polutek.pl',
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'token',
    ...overrides,
  };
}

function db({ creator, setting = creator ? { value: creator.id } : null, publicVideoCount = 1, sidebarVideoCount = 1, featured = { slug: 'welcome', title: 'Welcome' } }: any) {
  return {
    appSetting: {
      findUnique: async () => setting,
    },
    creator: {
      findUnique: async () => creator,
    },
    video: {
      count: async (args: any) => args.where?.showInSidebar ? sidebarVideoCount : publicVideoCount,
      findFirst: async () => featured,
    },
  };
}

const visibleCreator = { id: 'creator_1', slug: 'polutek', name: 'Polutek', status: 'ACTIVE', deletedAt: null };

describe('launch content diagnostics', () => {
  it('fails when the main_channel_id setting is missing and does not continue to false content checks', async () => {
    const result = await runLaunchContentDiagnostics({ env: productionEnv(), db: db({ creator: null, setting: null }) });

    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.name === 'main channel setting' && check.status === 'FAIL')).toBe(true);
    expect(result.checks.some((check) => check.name === 'main creator exists')).toBe(false);
  });

  it('fails when the configured main channel id has no creator', async () => {
    const result = await runLaunchContentDiagnostics({ env: productionEnv(), db: db({ creator: null, setting: { value: 'gone' } }) });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ name: 'main creator exists', status: 'FAIL' }));
  });

  it('fails when creator exists but has no public video', async () => {
    const result = await runLaunchContentDiagnostics({
      env: productionEnv(),
      db: db({ creator: visibleCreator, publicVideoCount: 0, sidebarVideoCount: 1, featured: null }),
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ name: 'anonymous public video inventory', status: 'FAIL' }));
    expect(result.checks).toContainEqual(expect.objectContaining({ name: 'homepage featured inventory', status: 'FAIL' }));
  });

  it('fails when the main channel exists but is not publicly visible (status)', async () => {
    const result = await runLaunchContentDiagnostics({ env: productionEnv(), db: db({ creator: { ...visibleCreator, status: 'SUSPENDED' } }) });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ name: 'main creator public', status: 'FAIL' }));
  });

  it('passes with a public main channel and public video inventory', async () => {
    const result = await runLaunchContentDiagnostics({ env: productionEnv(), db: db({ creator: visibleCreator }) });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ mainCreatorSlug: 'polutek', publicVideoCount: 1, sidebarVideoCount: 1, homepageFeaturedVideoSlug: 'welcome' });
  });

  it('does not produce a false pass when production config is missing beyond the main channel setting', async () => {
    const result = await runLaunchContentDiagnostics({ env: productionEnv({ DATABASE_URL: '' }), db: db({ creator: visibleCreator }) });

    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ name: 'production env validation', status: 'FAIL' }));
    expect(result.checks).toContainEqual(expect.objectContaining({ name: 'env:DATABASE_URL', status: 'FAIL' }));
  });
});
