import { AccessTier, VideoStatus } from '@prisma/client';
import { validateAppEnv } from '@/lib/env/validation';
import { visiblePublishedAtFilter } from '@/lib/services/content/video.service';

type DiagnosticDb = {
  creator: {
    findUnique(args: unknown): Promise<any>;
  };
  video: {
    count(args: unknown): Promise<number>;
    findFirst(args: unknown): Promise<any>;
  };
};

export type LaunchDiagnosticCheck = {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
  action?: string;
};

export type LaunchDiagnosticsResult = {
  ok: boolean;
  checks: LaunchDiagnosticCheck[];
  summary: {
    mainCreatorSlug: string | null;
    publicVideoCount: number | null;
    sidebarVideoCount: number | null;
    homepageFeaturedVideoSlug: string | null;
  };
};

function hasValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function push(checks: LaunchDiagnosticCheck[], check: LaunchDiagnosticCheck) {
  checks.push(check);
}

const requiredLaunchRuntimeVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'MAIN_CREATOR_SLUG',
] as const;

export async function runLaunchContentDiagnostics(options: {
  env?: NodeJS.ProcessEnv;
  db: DiagnosticDb;
  now?: Date;
}): Promise<LaunchDiagnosticsResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const checks: LaunchDiagnosticCheck[] = [];
  const summary: LaunchDiagnosticsResult['summary'] = {
    mainCreatorSlug: null,
    publicVideoCount: null,
    sidebarVideoCount: null,
    homepageFeaturedVideoSlug: null,
  };

  const appEnv = validateAppEnv(env, 'production');
  if (appEnv.success) {
    push(checks, { name: 'production env validation', status: 'PASS', detail: 'Required production environment variables passed application validation.' });
  } else {
    push(checks, {
      name: 'production env validation',
      status: 'FAIL',
      detail: appEnv.errors.join(' '),
      action: 'Set the missing/invalid production variables, then rerun npm run launch:diagnose. Do not treat a route 404 or skeleton as launch evidence while this fails.',
    });
  }

  for (const key of requiredLaunchRuntimeVars) {
    push(checks, hasValue(env[key])
      ? { name: `env:${key}`, status: 'PASS', detail: `${key} is present.` }
      : { name: `env:${key}`, status: 'FAIL', detail: `${key} is missing or empty.`, action: `Configure ${key} in the production environment.` });
  }

  const slug = env.MAIN_CREATOR_SLUG?.trim() || null;
  summary.mainCreatorSlug = slug;

  if (!slug) {
    return finalize(checks, summary);
  }

  const creator = await options.db.creator.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, isApproved: true, isPrimary: true },
  });

  if (!creator) {
    push(checks, {
      name: 'main creator exists',
      status: 'FAIL',
      detail: `No Creator row exists for MAIN_CREATOR_SLUG=${slug}.`,
      action: 'Create or repair the intended production creator, then rerun diagnostics. Use npm run content:fix:main-creator only if the operator intentionally wants its existing seed/repair behavior.',
    });
    return finalize(checks, summary);
  }

  push(checks, { name: 'main creator exists', status: 'PASS', detail: `Found creator ${creator.name} (${creator.slug}).` });

  if (!creator.isApproved) {
    push(checks, { name: 'main creator approved', status: 'FAIL', detail: 'Configured creator is not approved.', action: 'Approve the intended creator in the admin/database.' });
  } else {
    push(checks, { name: 'main creator approved', status: 'PASS', detail: 'Configured creator is approved.' });
  }

  if (!creator.isPrimary) {
    push(checks, { name: 'main creator primary', status: 'FAIL', detail: 'Configured creator is not marked primary.', action: 'Mark exactly the intended launch creator as primary.' });
  } else {
    push(checks, { name: 'main creator primary', status: 'PASS', detail: 'Configured creator is primary.' });
  }

  const baseWhere = {
    creatorId: creator.id,
    status: VideoStatus.PUBLISHED,
    creator: { isApproved: true, isPrimary: true },
    ...visiblePublishedAtFilter(now),
  };

  const publicVideoCount = await options.db.video.count({ where: { ...baseWhere, tier: AccessTier.PUBLIC } });
  summary.publicVideoCount = publicVideoCount;
  push(checks, publicVideoCount > 0
    ? { name: 'anonymous public video inventory', status: 'PASS', detail: `Found ${publicVideoCount} published PUBLIC video(s) for anonymous smoke.` }
    : { name: 'anonymous public video inventory', status: 'FAIL', detail: 'No published PUBLIC videos are visible for the configured creator.', action: 'Publish at least one PUBLIC video for the configured creator with publishedAt empty or in the past.' });

  const featured = await options.db.video.findFirst({
    where: { ...baseWhere, tier: AccessTier.PUBLIC, isMainFeatured: true },
    select: { slug: true, title: true },
  }) ?? await options.db.video.findFirst({
    where: { ...baseWhere, tier: AccessTier.PUBLIC },
    orderBy: [{ sidebarOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { slug: true, title: true },
  });
  summary.homepageFeaturedVideoSlug = featured?.slug ?? null;
  push(checks, featured
    ? { name: 'homepage featured inventory', status: 'PASS', detail: `Homepage can select public video ${featured.slug}.` }
    : { name: 'homepage featured inventory', status: 'FAIL', detail: 'Homepage cannot select a public featured/fallback video.', action: 'Set one visible PUBLIC video as main featured or provide any visible PUBLIC video fallback.' });

  const sidebarVideoCount = await options.db.video.count({
    where: { ...baseWhere, showInSidebar: true, tier: { in: [AccessTier.PUBLIC, AccessTier.LOGGED_IN, AccessTier.PATRON] } },
  });
  summary.sidebarVideoCount = sidebarVideoCount;
  push(checks, sidebarVideoCount > 0
    ? { name: 'sidebar/channel inventory', status: 'PASS', detail: `Sidebar/channel inventory can resolve ${sidebarVideoCount} visible video(s).` }
    : { name: 'sidebar/channel inventory', status: 'FAIL', detail: 'Sidebar/channel inventory has no visible videos.', action: 'Ensure at least one published visible video has showInSidebar=true for the configured creator.' });

  return finalize(checks, summary);
}

function finalize(checks: LaunchDiagnosticCheck[], summary: LaunchDiagnosticsResult['summary']): LaunchDiagnosticsResult {
  return { ok: checks.every((check) => check.status !== 'FAIL'), checks, summary };
}
