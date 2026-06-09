import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('R10 Foundation Inventory Presence', () => {
  const auditDir = path.join(process.cwd(), 'docs/audit');

  it('should have legacy service inventory', () => {
    expect(fs.existsSync(path.join(auditDir, 'R10-Legacy-Service-Inventory.md'))).toBe(true);
  });

  it('should have direct prisma inventory', () => {
    expect(fs.existsSync(path.join(auditDir, 'R10-Direct-Prisma-Inventory.md'))).toBe(true);
  });

  it('should have access policy inventory', () => {
    expect(fs.existsSync(path.join(auditDir, 'R10-AccessPolicy-Inventory.md'))).toBe(true);
  });

  it('should have cleanup readiness report', () => {
    expect(fs.existsSync(path.join(auditDir, 'R10-Cleanup-Readiness.md'))).toBe(true);
  });

  it('should have dead code candidates report', () => {
    expect(fs.existsSync(path.join(auditDir, 'R10-Dead-Code-Candidates.md'))).toBe(true);
  });
});
