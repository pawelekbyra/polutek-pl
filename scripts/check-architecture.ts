import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MODULES_DIR = path.join(ROOT, 'lib/modules');

const FORBIDDEN_IMPORTS = [
  'next/server',
  'next/navigation',
  'next/cache',
  'NextResponse',
  'app/',
  // The identity library is wired only in lib/auth (CLAUDE.md 4.12), never inside a module.
  'better-auth',
  'lib/api/',
];

const PREMIERE_HELPER_REASON =
  'Pure, dependency-free isUpcomingPremiere() helper (CLAUDE.md "Premieres"); the video barrel pulls media/channel code (circular deps) and several tests mock the whole @/lib/modules/video barrel, which would silently drop the premiere gate.';

const VISIBILITY_HELPER_REASON =
  'Pure, dependency-free status/18+ helpers (UNLISTED is link-reachable, adult is signed-in only); one definition shared by access and the video queries, and several tests mock the whole @/lib/modules/video barrel, which would silently drop the rule.';

// Allowlist for cross-module internal imports where extracting to shared would cause circular deps.
// Key: file path; value: map of "module/subPath" → reason string.
const CROSS_MODULE_INTERNAL_IMPORT_ALLOWLIST: Record<string, Record<string, string>> = {
  'lib/modules/channel/application/home-content.loader.ts': {
    'video/infrastructure/video-content.service': 'VideoContentService is an infra service; exporting via video index causes channel↔video circular dep through MainChannelService.',
  },
  'lib/modules/channel/infrastructure/creator-content.service.ts': {
    'video/infrastructure/video-content.service': 'VideoContentService is an infra service; exporting via video index causes channel↔video circular dep through MainChannelService.',
  },
  'lib/modules/users/application/patron-read-model.ts': {
    'patron/domain/patron-read-model': 'Pure, no-side-effect derivation helper re-exported for admin user read models; routing through the patron module\'s public index would entangle it with tests that mock the whole @/lib/modules/patron barrel (grantPatron/revokePatron).',
  },
  'lib/modules/playback/application/playback.service.ts': {
    'video/domain/premiere': PREMIERE_HELPER_REASON,
  },
  'lib/modules/media/application/get-gated-media.use-case.ts': {
    'video/domain/premiere': PREMIERE_HELPER_REASON,
  },
  'lib/modules/channel/application/channel-layout.service.ts': {
    'video/domain/premiere': PREMIERE_HELPER_REASON,
  },
  'lib/modules/video/domain/public-visibility.ts': {
    'channel/domain/channel.policy': 'Pure, no-side-effect policy class (the one rule for a publicly visible channel); the video domain needs only that predicate, not the channel barrel with its services.',
  },
  'lib/modules/access/application/check-video-access.use-case.ts': {
    'video/domain/premiere': PREMIERE_HELPER_REASON,
    'video/domain/video-visibility': VISIBILITY_HELPER_REASON,
    'channel/domain/channel.policy': 'Pure, no-side-effect policy class; many tests narrowly mock the whole @/lib/modules/channel barrel for MainChannelService only, and routing this through it would force every such test to also mock MainChannelPolicy.',
  },
};

function checkModules() {
  let violations = 0;

  if (!fs.existsSync(MODULES_DIR)) return 0;

  const files = getAllFiles(MODULES_DIR);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = rel(file);

    // 1. Forbidden Next.js/App/identity-library imports in modules
    // thumbnail-response.service.ts is a Next.js-specific HTTP response builder in infra layer
    const isNextJsInfraException = relativePath === 'lib/modules/media/infrastructure/thumbnail-response.service.ts';
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (isNextJsInfraException && (forbidden === 'next/server' || forbidden === 'NextResponse')) continue;
      if (content.includes(`from '${forbidden}'`) || content.includes(`from "${forbidden}"`)) {
        console.error(`❌ Violation: Forbidden import '${forbidden}' in ${relativePath}`);
        violations++;
      }
    }

    if (content.includes('NextResponse')) {
        // thumbnail-response.service.ts is a Next.js-specific HTTP response builder
        // legitimately placed in the media infrastructure layer
        if (relativePath !== 'lib/modules/media/infrastructure/thumbnail-response.service.ts') {
            console.error(`❌ Violation: Forbidden use of 'NextResponse' in ${relativePath}`);
            violations++;
        }
    }

    // 2. Cross-module internal imports
    const moduleMatch = relativePath.match(/lib\/modules\/([^/]+)/);
    if (moduleMatch) {
      const currentModule = moduleMatch[1];
      const importMatches = content.matchAll(/from ['"]@\/lib\/modules\/([^/'"]+)\/([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importedModule = match[1];
        const subPath = match[2];
        if (importedModule !== currentModule && importedModule !== 'shared' && subPath !== 'index') {
          const allowedReason = CROSS_MODULE_INTERNAL_IMPORT_ALLOWLIST[relativePath]?.[`${importedModule}/${subPath}`];
          if (!allowedReason) {
            console.error(`❌ Violation: Cross-module internal import in ${relativePath}: importing from ${importedModule}/${subPath} instead of @/lib/modules/${importedModule}`);
            violations++;
          }
        }
      }
    }
  }

  return violations;
}

function checkLegacyChannelAdapter() {
  let violations = 0;
  let adapterImports = 0;

  const files = getAllFiles(ROOT);
  for (const file of files) {
    const relativePath = rel(file);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.next') || relativePath.startsWith('dist')) continue;

    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("@/lib/channel/main-channel.service")) {
      adapterImports++;
      if (relativePath.startsWith('lib/modules/')) {
        console.error(`❌ Violation: Modular code must not import legacy channel adapter: ${relativePath}`);
        violations++;
      }
    }
  }

  console.log(`- Files importing @/lib/channel/main-channel.service: ${adapterImports}`);
  return violations;
}

const CLOSED_MODULES = ['video', 'video-pipeline', 'users', 'channel', 'audit', 'media', 'access', 'comments', 'subscriptions'];

const KNOWN_ROUTE_VIOLATIONS_ALLOWLIST: Record<string, string> = {};

const ROUTE_SERVICE_IMPORT_ALLOWLIST: Record<string, string> = {};

const USER_PROFILE_SERVICE_ALLOWLIST: Record<string, string> = {};

const PRISMA_ROUTES_ALLOWLIST: Record<string, string> = {};

function checkRoutes() {
  let violations = 0;
  const apiDir = path.join(ROOT, 'app/api');
  if (!fs.existsSync(apiDir)) return 0;

  let prismaImportsCount = 0;
  let servicesImports = 0;
  let allowedServicesImports = 0;
  let internalModuleImportsCount = 0;

  const files = getAllFiles(apiDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = rel(file);
    const allowReason = KNOWN_ROUTE_VIOLATIONS_ALLOWLIST[relativePath];

    if (content.includes("@/lib/prisma")) {
        prismaImportsCount++;
        if (!PRISMA_ROUTES_ALLOWLIST[relativePath]) {
            console.error(`❌ Violation: Direct Prisma import in new route: ${relativePath}. Use modules instead.`);
            violations++;
        }
    }
    const serviceImportMatches = [...content.matchAll(/(?:from\s+['"]|import\(['"])@\/lib\/services\/([^'")]+)/g)];
    if (serviceImportMatches.length > 0) {
        servicesImports++;
        const routeServiceAllowReason = ROUTE_SERVICE_IMPORT_ALLOWLIST[relativePath];
        if (!routeServiceAllowReason) {
            const imports = serviceImportMatches.map((match) => `@/lib/services/${match[1]}`).join(', ');
            console.error(`❌ Violation: Direct @/lib/services/ import in route ${relativePath}: ${imports}. Add an explicit temporary allowlist reason or move through modules.`);
            violations++;
        } else {
            allowedServicesImports++;
            console.log(`⚠️ Allowed temporary route service import: ${relativePath} — ${routeServiceAllowReason}`);
        }
    }

    // 1. Internal module imports check
    const internalMatches = [...content.matchAll(/from ['"]@\/lib\/modules\/([^'"\/]+)\/(?!index|db|app-context|actor|app-error|result)([^'"]+)['"]/g)];
    for (const match of internalMatches) {
        internalModuleImportsCount++;
        if (!allowReason) {
            console.error(`❌ Route bypasses module index: ${relativePath}. Import from '@/lib/modules/${match[1]}' instead.`);
            violations++;
        }
    }

    // 2. Closed module mixed with Prisma/Services check
    const usesClosedModule = CLOSED_MODULES.some(mod =>
        content.includes(`from '@/lib/modules/${mod}'`) ||
        content.includes(`from "@/lib/modules/${mod}"`)
    );

    if (usesClosedModule && !allowReason) {
        if (content.includes("@/lib/prisma")) {
            console.error(`❌ Route uses closed module but still imports @/lib/prisma: ${relativePath}`);
            violations++;
        }
        if (content.includes("@/lib/services/") && !ROUTE_SERVICE_IMPORT_ALLOWLIST[relativePath]) {
            console.error(`❌ Route uses closed module but still imports unapproved @/lib/services/: ${relativePath}`);
            violations++;
        }
    }

    // 3. Direct repository/infrastructure imports in routes (older check, still valid)
    if (content.includes('.repository') || content.includes('/infrastructure/')) {
       const matches = content.match(/from ['"]@\/lib\/modules\/[^'"]+['"]/g);
       if (matches) {
           for (const match of matches) {
               if (match.includes('.repository') || match.includes('/infrastructure/')) {
                   if (!allowReason) {
                        console.error(`❌ Violation: Direct infrastructure/repository import in route ${relativePath}: ${match}`);
                        violations++;
                   }
               }
           }
       }

       // Check relative imports as well
       const relativeMatches = content.match(/from ['"]\.\.?\/[^'"]+['"]/g);
       if (relativeMatches) {
           for (const match of relativeMatches) {
               if (match.includes(".repository") || match.includes("/infrastructure/")) {
                   if (!allowReason) {
                        console.error(`❌ Violation: Direct relative infrastructure/repository import in route ${relativePath}: ${match}`);
                        violations++;
                   }
               }
           }
       }
    }
  }

  console.log(`\nRoute check statistics:`);
  console.log(`- Routes importing @/lib/prisma: ${prismaImportsCount} (${Object.keys(PRISMA_ROUTES_ALLOWLIST).length} allowlisted)`);
  console.log(`- Routes importing @/lib/services/: ${servicesImports} (${allowedServicesImports} explicitly allowlisted)`);
  console.log(`- Routes with internal module imports: ${internalModuleImportsCount}`);

  return violations;
}

/**
 * Repo-relative path with forward slashes. Every check below compares against POSIX-style paths
 * ('lib/modules/...', startsWith('tests/')); with native separators on Windows they never matched,
 * which produced 6 false violations locally (exceptions and skips silently stopped applying).
 */
function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

// Never scanned: dependencies, build output, VCS data, and agent worktrees (.claude/worktrees holds
// full copies of the repo, which would be reported as violations of this checkout).
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git', 'dist', 'coverage', '.claude']);

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(file)) return;
      results = results.concat(getAllFiles(fullPath));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

function checkUserProfileServiceUsage() {
  let violations = 0;
  let usageCount = 0;

  const files = getAllFiles(ROOT);
  for (const file of files) {
    const relativePath = rel(file);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.next') || relativePath.startsWith('dist')) continue;
    if (relativePath === 'lib/services/user/profile.service.ts') continue;
    if (relativePath === 'lib/modules/users/application/sync-user.use-case.ts') continue;
    if (relativePath === 'scripts/check-architecture.ts') continue;

    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("UserProfileService") || content.includes("UserService.getOrCreateUser") || content.includes("@/lib/services/user/profile.service")) {
      usageCount++;

      const allowReason = USER_PROFILE_SERVICE_ALLOWLIST[relativePath];
      if (!allowReason) {
        console.error(`❌ Violation: Direct UserProfileService/getOrCreateUser usage forbidden: ${relativePath}. Use @/lib/modules/users bridge instead.`);
        violations++;
      }
    }
  }

  console.log(`- Files with UserProfileService usage: ${usageCount} (${Object.keys(USER_PROFILE_SERVICE_ALLOWLIST).length} allowlisted)`);
  return violations;
}

function checkDecommissionedAccessPolicySurface() {
  let violations = 0;
  let foundViolations = 0;

  const legacyKeywords = [
    'lib/access/access-policy',
    '@/lib/access/access-policy',
    '../access/access-policy',
    './access/access-policy',
    'lib/access/comment-access',
    '@/lib/access/comment-access',
    '../access/comment-access',
    './access/comment-access',
    'AccessPolicy.canViewVideo',
    'AccessPolicy.canComment',
    'AccessPolicy.canReactToVideo',
    'AccessPolicy.canReactToComment',
    'isPatronLikeUser',
    'getCommentAccessState'
  ];

  const files = getAllFiles(ROOT);
  for (const file of files) {
    const relativePath = rel(file);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.next') || relativePath.startsWith('dist') || relativePath.startsWith('.git')) continue;
    if (relativePath.startsWith('tests/')) continue;
    if (relativePath === 'scripts/check-architecture.ts') continue;

    const content = fs.readFileSync(file, 'utf-8');
    for (const keyword of legacyKeywords) {
      if (content.includes(keyword)) {
        console.error(`❌ Violation: Reference to decommissioned legacy access surface '${keyword}' found in ${relativePath}.`);
        violations++;
        foundViolations++;
        break; // One violation per file is enough to log
      }
    }
  }

  console.log(`- Files with decommissioned legacy access surface references: ${foundViolations}`);
  return violations;
}

/**
 * apps/admin (admin.pawelperfect.com, docs/architecture/admin-panel.md) is a separate app with its own auth.
 * It may use domain modules only through their index (plus the shared context), must never import the
 * public site's identity (lib/auth, lib/api/auth) or its UI (app/), and touches Prisma directly only in
 * its own auth layer (apps/admin/lib/auth) and the server-side enrollment script.
 */
const ADMIN_APP_DIR = path.join(ROOT, 'apps/admin');
const ADMIN_FORBIDDEN_IMPORTS: [RegExp, string][] = [
  [/from ['"]@\/lib\/auth(\/|['"])/, 'the public site auth (lib/auth); the panel has its own Better Auth instance'],
  [/from ['"]@\/lib\/api\/auth['"]/, 'the public site actor (lib/api/auth)'],
  [/from ['"]@\/app\//, 'public site UI (app/)'],
  [/from ['"]@\/components\//, 'public site UI (components/)'],
];

function checkAdminApp() {
  let violations = 0;
  if (!fs.existsSync(ADMIN_APP_DIR)) return 0;
  const files = getAllFiles(ADMIN_APP_DIR).filter((f) => !f.includes(`${path.sep}.next${path.sep}`) && !f.includes(`${path.sep}node_modules${path.sep}`));
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = rel(file);
    for (const [pattern, what] of ADMIN_FORBIDDEN_IMPORTS) {
      if (pattern.test(content)) {
        console.error(`❌ Violation: ${relativePath} imports ${what}.`);
        violations++;
      }
    }
    for (const match of content.matchAll(/from ['"]@\/lib\/modules\/([^/'"]+)\/([^'"]+)['"]/g)) {
      if (match[1] === 'shared') continue;
      console.error(`❌ Violation: ${relativePath} deep-imports @/lib/modules/${match[1]}/${match[2]}; use @/lib/modules/${match[1]}.`);
      violations++;
    }
    if (content.includes('@/lib/prisma') && !relativePath.startsWith('apps/admin/lib/auth/')) {
      console.error(`❌ Violation: ${relativePath} imports @/lib/prisma; read data through @/lib/modules/* (only apps/admin/lib/auth may use Prisma).`);
      violations++;
    }
  }
  console.log(`- apps/admin files checked: ${files.length}`);
  return violations;
}

// CLAUDE.md 4.23: every use case that changes or exposes channel content authorizes through lib/modules/authz.
// A file in these modules' application layer must call authorize()/assertAuthorized()/requireVideo() or be listed
// here with the reason it is exempt (public read, pure helper, worker/cron acting as `system`, or it only delegates
// to a function that authorizes).
const AUTHZ_MODULES = ['video', 'video-pipeline', 'admin-content', 'channel', 'sales', 'creator-analytics'];
const AUTHZ_EXEMPT: Record<string, string> = {
  'lib/modules/creator-analytics/application/context.ts': 'wiring helpers; every analytics use case calls authorize() itself',
  'lib/modules/creator-analytics/application/snapshot-subscribers.use-case.ts': 'daily cron; refuses any actor other than system',
  'lib/modules/video/application/admin-video-payload.ts': 'pure DTO helper, no I/O',
  'lib/modules/video/application/get-admin-video-details.use-case.ts': 'delegates to getAdminVideoById and getAdminVideoDiagnostics, which authorize',
  'lib/modules/video/application/get-hero-video.use-case.ts': 'public read (whitelisted DTO)',
  'lib/modules/video/application/get-public-video-by-id.use-case.ts': 'public read (whitelisted DTO, access via checkVideoAccess)',
  'lib/modules/video/application/get-public-video-list.use-case.ts': 'public read (whitelisted DTO)',
  'lib/modules/video/application/ready-visibility.ts': 'pending "publish when ready" visibility setting; called only by authorized use cases and the pipeline worker acting as system',
  'lib/modules/video/application/prune-stale-playback-sessions.use-case.ts': 'cron acting as system',
  'lib/modules/video/application/publish-after-asset-ready.use-case.ts': 'pipeline worker acting as system',
  'lib/modules/video/application/record-playback-event.use-case.ts': 'viewer playback telemetry bound to the playback session fingerprint',
  'lib/modules/video/application/sync-public-thumbnail.service.ts': 'cron/pipeline acting as system',
  'lib/modules/video/application/video-playback-route.service.ts': 'pipeline worker acting as system',
  'lib/modules/video/application/video-search.service.ts': 'public read (whitelisted DTO)',
  'lib/modules/video-pipeline/application/finalize-self-hls.ts': 'encode worker acting as system',
  'lib/modules/video-pipeline/application/process-encode-job.ts': 'encode worker acting as system',
  'lib/modules/video-pipeline/application/worker-loop.ts': 'encode worker acting as system',
  'lib/modules/video-pipeline/application/output-cleanup.use-cases.ts': 'system cleanup invoked after an authorized delete',
  'lib/modules/video-pipeline/application/channel-limits.ts': 'pure limit evaluation called from the authorized startOriginalUpload',
  'lib/modules/channel/application/content-report.use-case.ts': 'any signed-in viewer may report; the target must be publicly visible, duplicates and a daily cap apply',
  'lib/modules/channel/application/channel-layout.service.ts': 'public sidebar read',
  'lib/modules/channel/application/home-content.loader.ts': 'public home read',
  'lib/modules/channel/application/main-channel.service.ts': 'channel resolver, no permissions',
};

function checkAuthorizationCoverage() {
  let violations = 0;
  let checked = 0;
  for (const mod of AUTHZ_MODULES) {
    const dir = path.join(MODULES_DIR, mod, 'application');
    if (!fs.existsSync(dir)) continue;
    for (const file of getAllFiles(dir).filter((f) => f.endsWith('.ts'))) {
      const relativePath = rel(file);
      if (AUTHZ_EXEMPT[relativePath]) continue;
      checked++;
      const content = fs.readFileSync(file, 'utf-8');
      if (!/\b(authorize|assertAuthorized|requireVideo)\(/.test(content)) {
        console.error(`❌ Violation: ${relativePath} has no authorize()/assertAuthorized()/requireVideo() call (CLAUDE.md 4.23). Authorize in the use case, or exempt it in AUTHZ_EXEMPT with a reason.`);
        violations++;
      }
    }
  }
  console.log(`- Authorization coverage: ${checked} use case files checked, ${Object.keys(AUTHZ_EXEMPT).length} exempt`);
  return violations;
}

const totalViolations = checkModules() + checkRoutes() + checkLegacyChannelAdapter() + checkUserProfileServiceUsage() + checkDecommissionedAccessPolicySurface() + checkAdminApp() + checkAuthorizationCoverage();

if (totalViolations > 0) {
  console.error(`\nFound ${totalViolations} architectural violations.`);
  process.exit(1);
} else {
  console.log('✅ Architecture check passed.');
  process.exit(0);
}
