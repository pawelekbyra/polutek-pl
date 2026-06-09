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

const CLOSED_MODULES = ['video', 'users', 'channel', 'audit', 'media', 'access'];

const KNOWN_ROUTE_VIOLATIONS_ALLOWLIST: Record<string, string> = {
  'app/api/webhooks/clerk/route.ts':
    'R5/R9 boundary: webhook still has direct prisma/legacy boundary or was just migrated; mix of user sync and legacy email logic.',
  'app/api/admin/videos/resync/route.ts':
    'R6 cert: use case exists, but audit module transition or slight remaining legacy may trigger mixed mode.',
  'app/api/access/route.ts':
    'R6 cert: migrated to modular access use case.',
  'app/api/admin/videos/[id]/route.ts':
    'R6 blocker: mixed route, uses Video module but diagnostics/audit details remain as legacy extension.',
  'app/api/admin/videos/route.ts':
    'R6 blocker: mixed route, uses Video module but still relies on legacy services for list filters.',
  'app/api/comments/[commentId]/reaction/route.ts':
    'R2/R8 blocker: mixed route, uses Audit module but comments are not yet fully migrated.',
  'app/api/comments/[commentId]/report/route.ts':
    'R2/R8 blocker: mixed route, uses Audit module but comments are not yet fully migrated.',
  'app/api/comments/[commentId]/route.ts':
    'R2/R8 blocker: mixed route, uses Audit module but comments are not yet fully migrated.',
  'app/api/subscriptions/route.ts':
    'R5/R7 blocker: mixed route, uses Users module but subscriptions are direct Prisma.',
  'app/api/videos/[id]/comments/route.ts':
    'R2/R8 blocker: mixed route, uses Audit module but comments/videos list is still legacy.',
  'app/api/admin/users/route.ts':
    'R5 blocker: admin users list is still legacy/direct Prisma.',
  'app/api/admin/users/[userId]/route.ts':
    'R5 blocker: admin user details are still legacy/direct Prisma.',
  'app/api/admin/users/export/route.ts':
    'R5 blocker: admin user export is still legacy/direct Prisma.',
  'app/api/admin/users/stats/route.ts':
    'R5 blocker: admin user stats are still legacy/direct Prisma.',
  'app/api/admin/users/[userId]/patron/route.ts':
    'R7 blocker: admin patron management is legacy/patron service.',
};

function checkRoutes() {
  let violations = 0;
  const apiDir = path.join(ROOT, 'app/api');
  if (!fs.existsSync(apiDir)) return 0;

  let prismaImports = 0;
  let servicesImports = 0;
  let internalModuleImportsCount = 0;

  const files = getAllFiles(apiDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT, file);
    const allowReason = KNOWN_ROUTE_VIOLATIONS_ALLOWLIST[relativePath];

    if (content.includes("@/lib/prisma")) prismaImports++;
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
  console.log(`- Routes importing @/lib/prisma: ${prismaImports}`);
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

const totalViolations = checkModules() + checkRoutes() + checkLegacyChannelAdapter();

if (totalViolations > 0) {
  console.error(`\nFound ${totalViolations} architectural violations.`);
  process.exit(1);
} else {
  console.log('✅ Architecture check passed.');
  process.exit(0);
}
