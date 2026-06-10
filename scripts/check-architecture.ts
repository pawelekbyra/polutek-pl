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
  '@clerk/nextjs',
  'lib/api/',
];

function checkModules() {
  let violations = 0;

  if (!fs.existsSync(MODULES_DIR)) return 0;

  const files = getAllFiles(MODULES_DIR);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT, file);

    // 1. Forbidden Next.js/App/Clerk imports in modules
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (content.includes(`from '${forbidden}'`) || content.includes(`from "${forbidden}"`) || content.includes(`from "@clerk/nextjs"`)) {
        console.error(`❌ Violation: Forbidden import '${forbidden}' in ${relativePath}`);
        violations++;
      }
    }

    if (content.includes('NextResponse')) {
        console.error(`❌ Violation: Forbidden use of 'NextResponse' in ${relativePath}`);
        violations++;
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
           console.error(`❌ Violation: Cross-module internal import in ${relativePath}: importing from ${importedModule}/${subPath} instead of @/lib/modules/${importedModule}`);
           violations++;
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
    const relativePath = path.relative(ROOT, file);
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

const CLOSED_MODULES = ['video', 'users', 'channel', 'audit', 'media', 'access', 'comments'];

const KNOWN_ROUTE_VIOLATIONS_ALLOWLIST: Record<string, string> = {
  'app/api/webhooks/clerk/route.ts':
    'R5/R9 boundary: webhook boundary clean but mixed with legacy EmailService until R9.',
  'app/api/admin/videos/resync/route.ts':
    'R6 cert: use case exists, but audit module transition or slight remaining legacy may trigger mixed mode.',
  'app/api/admin/videos/[id]/route.ts':
    'R6 blocker: mixed route, uses Video module but diagnostics/audit details remain as legacy extension.',
  'app/api/admin/videos/route.ts':
    'R6 blocker: mixed route, uses Video module but still relies on legacy services for list filters.',
  'app/api/comments/[commentId]/reaction/route.ts':
    'R8 cert: migrated to modular access/use cases.',
  'app/api/comments/[commentId]/report/route.ts':
    'R8 cert: migrated to modular access/use cases.',
  'app/api/comments/[commentId]/route.ts':
    'R8 cert: migrated to modular access/use cases.',
  'app/api/comments/[commentId]/replies/route.ts':
    'R8 cert: migrated to modular access/use cases.',
  'app/api/comments/[commentId]/pin/route.ts':
    'R8 cert: migrated to modular use cases.',
  'app/api/comments/[commentId]/context/route.ts':
    'R8 cert: migrated to modular use cases.',
  'app/api/subscriptions/route.ts':
    'R5/R7 blocker: mixed route, uses Users module but subscriptions are direct Prisma.',
  'app/api/videos/[id]/comments/route.ts':
    'R8 cert: migrated to modular access/use cases.',
  'app/api/admin/comments/route.ts':
    'R8 cert: migrated to modular use case.',
  'app/api/media-source/[videoId]/route.ts':
    'R6/R3 certified: uses PlaybackService and modular access.',
  'app/api/videos/[id]/playback-event/route.ts':
    'R6/R3 cert: uses modular access, but still uses direct Prisma for event/view persistence.',
  'app/api/admin/users/route.ts':
    'R5 cert: migrated to modular use case.',
  'app/api/admin/users/[userId]/route.ts':
    'R5 blocker: mixed route, core user identity is modular, but extensions (payments, subscriptions) are legacy.',
  'app/api/admin/users/export/route.ts':
    'R5 cert: migrated to modular use case.',
  'app/api/admin/users/stats/route.ts':
    'R5 cert: migrated to modular use case.',
  'app/api/admin/users/[userId]/patron/route.ts':
    'R7 foundation: migrated to modular patron use cases.',
  'app/api/checkout/create-intent/route.ts':
    'R7 foundation: migrated to modular payments use case.',
  'app/api/webhooks/resend/route.ts':
    'R9 cert: migrated to modular email use case.',
  'app/api/admin/templates/route.ts':
    'R9 cert: migrated to modular use cases.',
  'app/api/admin/emails/broadcast/route.ts':
    'R9 cert: migrated to modular use case.',
  'app/api/admin/emails/responses/route.ts':
    'R9 cert: migrated to modular use case.',
  'app/api/webhooks/stripe/route.ts':
    'R7 core runtime migrated / modular webhook route.',
  'app/api/admin/payments/route.ts':
    'R7 foundation: migrated to modular payments use case.',
  'app/api/admin/payment-settings/route.ts':
    'R7 foundation: migrated to modular payments use case.',
  'app/api/admin/videos/[id]/comments/route.ts':
    'R8 cert: migrated to modular use case.',
  'app/api/user/referrals/claim/route.ts':
    'R5 future blocker: referrals claim depends on Users bridge but is still a legacy flow.',
};

const USER_PROFILE_SERVICE_ALLOWLIST: Record<string, string> = {
  'lib/modules/users/application/get-or-create-current-user.use-case.ts': 'R5 bridge: only allowed production bridge to legacy get-or-create behavior.',
  'lib/services/user.service.ts': 'R5 legacy facade: temporary compatibility wrapper.',
  'tests/unit/api-contracts.test.ts': 'Test usage.',
  'tests/unit/bola-protection.test.ts': 'Test usage.',
  'tests/unit/comment-reactions-route.test.ts': 'Test usage.',
  'tests/unit/admin-access.test.ts': 'Test usage.',
  'tests/unit/clerk-webhook-route.test.ts': 'Test usage.',
  'tests/unit/subscriptions-route.test.ts': 'Test usage.',
  'tests/unit/user-service.test.ts': 'Test usage.',
  'tests/unit/api-route-smoke.test.ts': 'Test usage.',
  'tests/unit/comments-route.test.ts': 'Test usage.',
  'tests/unit/admin-videos-crud.test.ts': 'Test usage.',
};

const PRISMA_ROUTES_ALLOWLIST: Record<string, string> = {
  'app/api/admin/users/[userId]/route.ts': 'R5 blocker: mixed route with legacy extensions.',
  'app/api/subscriptions/route.ts': 'R5/R7 blocker: mixed route.',
  'app/api/videos/[id]/playback-event/route.ts': 'R6/R3 certified mixed route.',
  'app/api/user/referrals/route.ts': 'R5 future blocker: referrals legacy.',
  'app/api/user/referrals/claim/route.ts': 'R5 future blocker: referrals legacy.',
  'app/api/admin/stats/route.ts': 'R11 blocker.',
  'app/api/admin/subscribers/resync/route.ts': 'R5 blocker.',
  'app/api/admin/videos/[id]/route.ts': 'R6 blocker.',
  'app/api/media/[...path]/route.ts': 'R3 delivery blocker.',
};

function checkRoutes() {
  let violations = 0;
  const apiDir = path.join(ROOT, 'app/api');
  if (!fs.existsSync(apiDir)) return 0;

  let prismaImportsCount = 0;
  let servicesImports = 0;
  let internalModuleImportsCount = 0;

  const files = getAllFiles(apiDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT, file);
    const allowReason = KNOWN_ROUTE_VIOLATIONS_ALLOWLIST[relativePath];

    if (content.includes("@/lib/prisma")) {
        prismaImportsCount++;
        if (!PRISMA_ROUTES_ALLOWLIST[relativePath]) {
            console.error(`❌ Violation: Direct Prisma import in new route: ${relativePath}. Use modules instead.`);
            violations++;
        }
    }
    if (content.includes("@/lib/services/")) servicesImports++;

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
        if (content.includes("@/lib/services/")) {
            console.error(`❌ Route uses closed module but still imports @/lib/services/: ${relativePath}`);
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
  console.log(`- Routes importing @/lib/services/: ${servicesImports}`);
  console.log(`- Routes with internal module imports: ${internalModuleImportsCount}`);

  return violations;
}

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
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
    const relativePath = path.relative(ROOT, file);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.next') || relativePath.startsWith('dist')) continue;
    if (relativePath === 'lib/services/user/profile.service.ts') continue;
    if (relativePath === 'scripts/check-architecture.ts') continue;

    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("UserProfileService") || content.includes("UserService.getOrCreateUser") || content.includes("@/lib/services/user/profile.service") || content.includes("@/lib/services/user.service")) {
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

function checkLegacyAccessPolicy() {
  let violations = 0;
  let policyImports = 0;

  const files = getAllFiles(ROOT);
  for (const file of files) {
    const relativePath = path.relative(ROOT, file);
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('.next') || relativePath.startsWith('dist')) continue;
    if (relativePath === 'lib/access/access-policy.ts') continue;
    if (relativePath === 'scripts/check-architecture.ts') continue;
    if (relativePath.startsWith('tests/unit/')) continue; // Tests are allowed to import legacy policy for now

    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("@/lib/access/access-policy") || content.includes("./access/access-policy")) {
      policyImports++;

      const allowReason = KNOWN_ROUTE_VIOLATIONS_ALLOWLIST[relativePath];
      const isExpectedLegacy = relativePath.includes('services/comments') ||
                               relativePath.includes('lib/actions/interactions.ts') ||
                               relativePath.includes('services/content/video.service.ts');

      if (!allowReason && !isExpectedLegacy) {
        console.error(`❌ Violation: New code must not import legacy AccessPolicy: ${relativePath}. Use lib/modules/access instead.`);
        violations++;
      }
    }
  }

  console.log(`- Files importing legacy AccessPolicy: ${policyImports}`);
  return violations;
}


const totalViolations = checkModules() + checkRoutes() + checkLegacyChannelAdapter() + checkLegacyAccessPolicy() + checkUserProfileServiceUsage();

if (totalViolations > 0) {
  console.error(`\nFound ${totalViolations} architectural violations.`);
  process.exit(1);
} else {
  console.log('✅ Architecture check passed.');
  process.exit(0);
}
