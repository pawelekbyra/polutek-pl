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

const CLOSED_MODULES = ['video', 'users', 'channel', 'audit', 'media', 'access', 'comments', 'subscriptions'];

const KNOWN_ROUTE_VIOLATIONS_ALLOWLIST: Record<string, string> = {};

const ROUTE_SERVICE_IMPORT_ALLOWLIST: Record<string, string> = {
  'app/api/media-source/[videoId]/route.ts':
    'Temporary legacy playback service bridge; tracked for Post-R media/provider cleanup.',
  'app/api/channel/sidebar/route.ts':
    'Temporary channel layout read-side bridge; tracked for future content/channel module cleanup.',
  'app/api/admin/users/[userId]/patron/route.ts':
    'Temporary user access bridge; tracked for PatronGrant/UserAccess cleanup.',
  'app/api/admin/users/route.ts':
    'Temporary admin query parser helper; move to route-local/module query DTO parser.',
  'app/api/admin/videos/route.ts':
    'Temporary admin query parser helper; move to route-local/module query DTO parser.',
  'app/api/videos/[videoId]/thumbnail/route.ts':
    'Temporary thumbnail proxy bridge; move to storage/media module.',
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
    const relativePath = path.relative(ROOT, file);
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
    const relativePath = path.relative(ROOT, file);
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

const totalViolations = checkModules() + checkRoutes() + checkLegacyChannelAdapter() + checkUserProfileServiceUsage() + checkDecommissionedAccessPolicySurface();

if (totalViolations > 0) {
  console.error(`\nFound ${totalViolations} architectural violations.`);
  process.exit(1);
} else {
  console.log('✅ Architecture check passed.');
  process.exit(0);
}
