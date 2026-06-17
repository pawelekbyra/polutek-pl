import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, 'scripts', 'strict-escapes-baseline.jsonc');
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

type BaselineEntry = Violation & {
  reason: string;
};

type StrictEscapesBaseline = {
  entries?: BaselineEntry[];
};

function isSourceFile(filePath: string) {
  return sourceExtensions.has(path.extname(filePath));
}

function collectFiles(entry: string): string[] {
  const absolutePath = path.join(repoRoot, entry);
  if (!existsSync(absolutePath)) return [];
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

function stripJsonComments(input: string) {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function readBaseline(): BaselineEntry[] {
  if (!existsSync(baselinePath)) return [];

  const parsed = JSON.parse(stripJsonComments(readFileSync(baselinePath, 'utf8'))) as StrictEscapesBaseline;
  if (!Array.isArray(parsed.entries)) {
    throw new Error('strict-escapes baseline must contain an entries array.');
  }

  return parsed.entries.map((entry, index) => {
    const location = `baseline entry #${index + 1}`;
    if (!entry.file || entry.file.includes('*') || path.isAbsolute(entry.file)) {
      throw new Error(`${location} must use a precise repository-relative file path without globs.`);
    }
    if (!Number.isInteger(entry.line) || entry.line < 1) {
      throw new Error(`${location} must include a positive integer line.`);
    }
    if (!entry.label || !forbiddenPatterns.some((pattern) => pattern.label === entry.label)) {
      throw new Error(`${location} must include a known violation label.`);
    }
    if (!entry.text || entry.text.trim() !== entry.text) {
      throw new Error(`${location} must include exact trimmed match text.`);
    }
    if (!entry.reason) {
      throw new Error(`${location} must include a reviewable reason.`);
    }
    return entry;
  });
}

function violationKey(violation: Violation) {
  return `${violation.file}:${violation.line}:${violation.label}:${violation.text}`;
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

let baseline: BaselineEntry[] = [];
try {
  baseline = readBaseline();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const violationKeys = new Set(violations.map(violationKey));
const baselineKeys = new Set<string>();
const duplicateBaselineEntries: BaselineEntry[] = [];
for (const entry of baseline) {
  const key = violationKey(entry);
  if (baselineKeys.has(key)) duplicateBaselineEntries.push(entry);
  baselineKeys.add(key);
}

const matchedHistorical = violations.filter((violation) => baselineKeys.has(violationKey(violation)));
const missingOrStale = baseline.filter((entry) => !violationKeys.has(violationKey(entry)));
const newUnbaselined = violations.filter((violation) => !baselineKeys.has(violationKey(violation)));

console.log(`Strict escapes baseline entries: ${baseline.length}`);
console.log(`Matched historical violations: ${matchedHistorical.length}`);
console.log(`Missing/stale baseline entries: ${missingOrStale.length}`);
console.log(`New unbaselined violations: ${newUnbaselined.length}`);

if (missingOrStale.length > 0) {
  console.error('Missing or stale strict-escapes baseline entries:');
  for (const violation of missingOrStale) {
    console.error(`- ${violation.file}:${violation.line} [${violation.label}] ${violation.text}`);
  }
}

if (newUnbaselined.length > 0) {
  console.error('New strict TypeScript escape hatches outside the approved baseline:');
  for (const violation of newUnbaselined) {
    console.error(`- ${violation.file}:${violation.line} [${violation.label}] ${violation.text}`);
  }
}

if (duplicateBaselineEntries.length > 0) {
  console.error('Duplicate strict-escapes baseline entries:');
  for (const violation of duplicateBaselineEntries) {
    console.error(`- ${violation.file}:${violation.line} [${violation.label}] ${violation.text}`);
  }
}

if (missingOrStale.length > 0 || newUnbaselined.length > 0 || duplicateBaselineEntries.length > 0) {
  process.exit(1);
}

if (violations.length === 0) {
  console.log('No @ts-ignore, @ts-nocheck, or explicit any escape hatches found in production source files.');
} else {
  console.log('Only approved historical strict TypeScript escape hatches were found; no new debt detected.');
}
