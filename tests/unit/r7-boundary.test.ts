import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('R7 Module Boundaries', () => {
  const patronDir = path.resolve(process.cwd(), 'lib/modules/patron');
  const paymentsDir = path.resolve(process.cwd(), 'lib/modules/payments');

  const getAllFiles = (dir: string): string[] => {
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
  };

  it('Patron module should not import illegal modules', () => {
    const files = getAllFiles(patronDir);
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain("from '@/lib/modules/payments'");
      expect(content).not.toContain("from '@/lib/modules/email'");
      expect(content).not.toContain("from 'stripe'");
      expect(content).not.toContain("from \"stripe\"");
      expect(content).not.toContain("from 'next/server'");
      expect(content).not.toContain("from '@clerk/nextjs'");
    });
  });

  it('Payments module should not import illegal modules', () => {
    const files = getAllFiles(paymentsDir);
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain("from '@/lib/modules/patron'");
      expect(content).not.toContain("from '@/lib/modules/email'");
      expect(content).not.toContain("from '@/lib/modules/comments'");
      expect(content).not.toContain("from 'next/server'");
      expect(content).not.toContain("from '@clerk/nextjs'");
    });
  });

  it('Legacy patron service bridge should stay removed', () => {
      const bridgePath = path.resolve(process.cwd(), 'lib/services/patron.service.ts');
      expect(fs.existsSync(bridgePath)).toBe(false);
  });

  it('Checkout route should not import legacy checkout service', () => {
      const routePath = path.resolve(process.cwd(), 'app/api/checkout/create-intent/route.ts');
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).not.toContain("@/lib/services/payments/checkout.service");
  });
});