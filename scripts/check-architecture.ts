import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MODULES_DIR = path.join(ROOT, 'lib/modules');

const FORBIDDEN_IMPORTS = [
  'next/server',
  'next/navigation',
  'next/cache',
  'app/',
];

function checkModules() {
  let violations = 0;

  if (!fs.existsSync(MODULES_DIR)) return 0;

  const files = getAllFiles(MODULES_DIR);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT, file);

    // 1. Forbidden Next.js/App imports in modules
    // Exception: lib/modules/shared/api-response.ts needs next/server for NextResponse
    if (!relativePath.includes('lib/modules/shared/api-response.ts')) {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (content.includes(`from '${forbidden}'`) || content.includes(`from "${forbidden}"`)) {
          console.error(`❌ Violation: Forbidden import '${forbidden}' in ${relativePath}`);
          violations++;
        }
      }

      if (content.includes('NextResponse')) {
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
           console.error(`❌ Violation: Cross-module internal import in ${relativePath}: importing from ${importedModule}/${subPath} instead of @/lib/modules/${importedModule}`);
           violations++;
        }
      }
    }
  }

  return violations;
}

function checkRoutes() {
  let violations = 0;
  const apiDir = path.join(ROOT, 'app/api');
  if (!fs.existsSync(apiDir)) return 0;

  const files = getAllFiles(apiDir);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT, file);

    // 3. Direct repository imports in routes
    if (content.includes('.repository') || content.includes('/infrastructure/')) {
       // Check if it's imported from ANY module
       const matches = content.match(/from ['"]@\/lib\/modules\/[^'"]+['"]/g);
       if (matches) {
           for (const match of matches) {
               if (match.includes('.repository') || match.includes('/infrastructure/')) {
                   console.error(`❌ Violation: Direct infrastructure/repository import in route ${relativePath}: ${match}`);
                   violations++;
               }
           }
       }

       // Also check relative imports
       if (content.includes("from './") || content.includes("from '../")) {
           if (content.includes(".repository") || content.includes("/infrastructure/")) {
                console.error(`❌ Violation: Direct relative infrastructure/repository import in route ${relativePath}`);
                violations++;
           }
       }
    }
  }
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

const totalViolations = checkModules() + checkRoutes();

if (totalViolations > 0) {
  console.error(`\nFound ${totalViolations} architectural violations.`);
  process.exit(1);
} else {
  console.log('✅ Architecture check passed.');
  process.exit(0);
}
