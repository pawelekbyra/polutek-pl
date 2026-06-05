import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const sourceRoots = ['app', 'components', 'lib', 'middleware.ts', 'next.config.mjs', 'vitest.config.ts'];
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredDirectories = new Set(['node_modules', '.next', '.git', 'coverage', 'public']);

const forbiddenPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: '@ts-ignore', pattern: /@ts-ignore/ },
  { label: '@ts-nocheck', pattern: /@ts-nocheck/ },
  { label: 'explicit any annotation', pattern: /(?<![A-Za-z0-9_$])(?:as\s+any|:\s*any\b|<any>|Array\s*<\s*any\s*>|Record\s*<[^>]*\bany\b[^>]*>|Promise\s*<\s*any\s*>|\bany\s*\[\s*\])/ },
];

type Violation = {
  file: string;
  line: number;
  label: string;
  text: string;
};

function isSourceFile(filePath: string) {
  return sourceExtensions.has(path.extname(filePath));
}

function collectFiles(entry: string): string[] {
  const absolutePath = path.join(repoRoot, entry);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return isSourceFile(absolutePath) ? [absolutePath] : [];
  }

  const files: string[] = [];
  for (const child of readdirSync(absolutePath)) {
    if (ignoredDirectories.has(child)) continue;

    const childPath = path.join(absolutePath, child);
    const childStat = statSync(childPath);
    if (childStat.isDirectory()) {
      files.push(...collectFiles(path.relative(repoRoot, childPath)));
    } else if (isSourceFile(childPath)) {
      files.push(childPath);
    }
  }

  return files;
}

const violations: Violation[] = [];

for (const root of sourceRoots) {
  for (const file of collectFiles(root)) {
    const relativeFile = path.relative(repoRoot, file);
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      for (const forbidden of forbiddenPatterns) {
        if (forbidden.pattern.test(line)) {
          violations.push({
            file: relativeFile,
            line: index + 1,
            label: forbidden.label,
            text: line.trim(),
          });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Strict TypeScript escape hatches are blocked in production source files.');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.label}] ${violation.text}`);
  }
  process.exit(1);
}

console.log('No @ts-ignore, @ts-nocheck, or explicit any escape hatches found in production source files.');
