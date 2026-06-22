import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * GUARDRAIL: Normal application code must NOT use prisma.user.delete() or deleteMany().
 *
 * This test ensures that any hard user deletion is intentional and restricted
 * to specific administrative or legal destructive workflows.
 */
describe('User Deletion Guardrail', () => {
  const rootDir = process.cwd();
  const searchDirs = ['lib', 'app'];

  // Allowed paths for hard user deletion (e.g. legal/admin destructive tools)
  const allowedPaths: string[] = [
    // Add paths here if they are explicitly reviewed and intended for hard-delete
  ];

  function getFiles(dir: string): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...getFiles(fullPath));
      } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('ensures no normal application code uses prisma.user.delete()', () => {
    const violations: string[] = [];

    for (const searchDir of searchDirs) {
      const fullSearchDir = path.join(rootDir, searchDir);
      if (!fs.existsSync(fullSearchDir)) continue;

      const files = getFiles(fullSearchDir);

      for (const file of files) {
        const relativePath = path.relative(rootDir, file);
        if (allowedPaths.some(p => relativePath.startsWith(p))) continue;

        const content = fs.readFileSync(file, 'utf8');

        // Look for .user.delete( or .user.deleteMany(
        // We look for .user to be somewhat specific to the user model in prisma
        if (content.includes('.user.delete(') || content.includes('.user.deleteMany(')) {
          violations.push(relativePath);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Hard user deletion found in normal application code:\n${violations.join('\n')}\n\n` +
        `Normal account deletion MUST use soft-delete/anonymization.\n` +
        `If this is a deliberate destructive/legal workflow, add it to the 'allowedPaths' in this test.`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
