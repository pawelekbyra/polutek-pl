import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Access Policy Decommissioning Guardrails', () => {
  const rootDir = process.cwd();

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist'].includes(file)) {
          getAllFiles(filePath, fileList);
        }
      } else {
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          fileList.push(filePath);
        }
      }
    });
    return fileList;
  }

  const allSourceFiles = getAllFiles(rootDir);

  it('no source file imports lib/access/access-policy', () => {
    const violations = allSourceFiles.filter(file => {
      // Skip this test file itself and documentation if any .ts/.tsx files are there
      if (file.includes('access-policy-decommissioning.test.ts')) return false;

      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('@/lib/access/access-policy') ||
             content.includes('../access/access-policy') ||
             content.includes('./access/access-policy');
    });

    expect(violations, `Files still importing AccessPolicy: ${violations.map(f => path.relative(rootDir, f)).join(', ')}`).toHaveLength(0);
  });

  it('no runtime file calls AccessPolicy.canViewVideo or AccessPolicy.canComment', () => {
    const violations = allSourceFiles.filter(file => {
      if (file.includes('access-policy-decommissioning.test.ts')) return false;
      // Allow matches in tests/ if they are intentional (e.g. checking for absence)
      // But we want to ensure NO runtime code calls it.
      if (file.includes('tests/')) return false;

      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('AccessPolicy.canViewVideo') ||
             content.includes('AccessPolicy.canComment');
    });

    expect(violations, `Runtime files still calling AccessPolicy: ${violations.map(f => path.relative(rootDir, f)).join(', ')}`).toHaveLength(0);
  });

  it('no runtime access module uses User.isPatron as the grant decision source', () => {
     // Specifically checking lib/modules/access/application/check-video-access.use-case.ts
     const checkAccessFile = path.join(rootDir, 'lib/modules/access/application/check-video-access.use-case.ts');
     if (fs.existsSync(checkAccessFile)) {
         const content = fs.readFileSync(checkAccessFile, 'utf-8');
         // It should NOT use user.isPatron for the final decision.
         // It CAN contain "user.isPatron" in comments or logs, but let's check for the logic.
         // We know it should use getPatronStatus.
         expect(content).toContain('getPatronStatus');

         // Check that it doesn't do something like: if (user.isPatron) return ok({ hasAccess: true });
         const legacyDecisionPattern = /if\s*\(user\.isPatron\)\s*{\s*return\s*ok\({\s*hasAccess:\s*true\s*}\);?\s*}/;
         expect(content).not.toMatch(legacyDecisionPattern);
     }
  });

  it('lib/access/access-policy.ts and lib/access/comment-access.ts do not exist', () => {
      expect(fs.existsSync(path.join(rootDir, 'lib/access/access-policy.ts'))).toBe(false);
      expect(fs.existsSync(path.join(rootDir, 'lib/access/comment-access.ts'))).toBe(false);
  });
});
