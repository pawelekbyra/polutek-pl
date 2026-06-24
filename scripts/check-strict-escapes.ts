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

function toRepoPath(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function stripJsonComments(input: string) {
  let output = '';
  let inString = false;
  let isEscaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (current === '\n' || current === '\r') {
        inLineComment = false;
        output += current;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      } else if (current === '\n' || current === '\r') {
        output += current;
      }
      continue;
    }

    if (inString) {
      output += current;

      if (isEscaped) {
        isEscaped = false;
      } else if (current === '\\') {
        isEscaped = true;
      } else if (current === '"') {
        inString = false;
      }

      continue;
    }

    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }

    if (current === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += current;
  }

  return output;
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

function violationIdentity(violation: Violation) {
  return `${violation.file}:${violation.label}:${violation.text}`;
}

function baselineFileExists(entry: BaselineEntry) {
  return existsSync(path.join(repoRoot, entry.file));
}

const violations: Violation[] = [];

for (const root of sourceRoots) {
  for (const file of collectFiles(root)) {
    const relativeFile = toRepoPath(file);
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

const deletedFileBaselineEntries = baseline.filter((entry) => !baselineFileExists(entry));
const activeBaseline = baseline.filter(baselineFileExists);

const violationIdentities = new Set(violations.map(violationIdentity));
const baselineIdentities = new Set<string>();
const duplicateBaselineEntries: BaselineEntry[] = [];
for (const entry of activeBaseline) {
  const identity = violationIdentity(entry);
  if (baselineIdentities.has(identity)) duplicateBaselineEntries.push(entry);
  baselineIdentities.add(identity);
}

const matchedHistorical = violations.filter((violation) => baselineIdentities.has(violationIdentity(violation)));
const missingOrStale = activeBaseline.filter((entry) => !violationIdentities.has(violationIdentity(entry)));
const newUnbaselined = violations.filter((violation) => !baselineIdentities.has(violationIdentity(violation)));

console.log(`Strict escapes baseline entries: ${baseline.length}`);
console.log(`Active baseline entries: ${activeBaseline.length}`);
console.log(`Deleted-file baseline entries: ${deletedFileBaselineEntries.length}`);
console.log(`Matched historical violations: ${matchedHistorical.length}`);
console.log(`Missing/stale baseline entries: ${missingOrStale.length}`);
console.log(`New unbaselined violations: ${newUnbaselined.length}`);
console.log(`Duplicate historical baseline identities: ${duplicateBaselineEntries.length}`);

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
  console.warn('Duplicate historical strict-escapes baseline identities detected; tolerated because line-drift matching uses file/label/text identity:');
  for (const violation of duplicateBaselineEntries) {
    console.warn(`- ${violation.file}:${violation.line} [${violation.label}] ${violation.text}`);
  }
}

if (missingOrStale.length > 0 || newUnbaselined.length > 0) {
  process.exit(1);
}

if (violations.length === 0) {
  console.log('No @ts-ignore, @ts-nocheck, or explicit any escape hatches found in production source files.');
} else {
  console.log('Only approved historical strict TypeScript escape hatches were found; no new debt detected.');
}