import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Email Module Import Boundary Guard', () => {
  const routes = [
    'app/api/admin/emails/broadcast/route.ts',
    'app/api/webhooks/resend/route.ts'
  ];

  it('routes must only import from the public module API, not internal paths', () => {
    routes.forEach(routePath => {
      if (!fs.existsSync(routePath)) return;
      const content = fs.readFileSync(routePath, 'utf8');

      // Forbidden: internal imports
      expect(content).not.toContain('@/lib/modules/email/application');
      expect(content).not.toContain('@/lib/modules/email/infrastructure');
      expect(content).not.toContain('@/lib/modules/email/domain');

      // Allowed: public API
      expect(content).toContain('@/lib/modules/email');
    });
  });

  it('application use cases must not import resend directly', () => {
    const appDir = 'lib/modules/email/application';
    if (!fs.existsSync(appDir)) return;

    const files = fs.readdirSync(appDir);
    files.forEach(file => {
      const content = fs.readFileSync(path.join(appDir, file), 'utf8');
      expect(content).not.toContain("from 'resend'");
      expect(content).not.toContain('from "resend"');
      expect(content).not.toContain('new Resend');
    });
  });

  it('email module must not import forbidden domains', () => {
    const moduleDir = 'lib/modules/email';
    if (!fs.existsSync(moduleDir)) return;

    const checkDir = (dir: string) => {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            if (fs.lstatSync(fullPath).isDirectory()) {
                checkDir(fullPath);
            } else if (item.endsWith('.ts')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                expect(content).not.toContain('@/lib/modules/payments');
                expect(content).not.toContain('@/lib/modules/patron');
                expect(content).not.toContain('@/lib/services/payments');
                expect(content).not.toContain('@/lib/services/patron.service');
                expect(content).not.toContain('PaymentService');
                expect(content).not.toContain('PatronGrant');
                expect(content).not.toContain('stripe');
                expect(content).not.toContain('checkout');
            }
        });
    };

    checkDir(moduleDir);
  });

  it('email module must not mutate User.isPatron', () => {
      const moduleDir = 'lib/modules/email';
      if (!fs.existsSync(moduleDir)) return;

      const checkDir = (dir: string) => {
          const items = fs.readdirSync(dir);
          items.forEach(item => {
              const fullPath = path.join(dir, item);
              if (fs.lstatSync(fullPath).isDirectory()) {
                  checkDir(fullPath);
              } else if (item.endsWith('.ts')) {
                  const content = fs.readFileSync(fullPath, 'utf8');
                  // Only forbid updates/mutations, not DTO creation or queries
                  // We look for patterns like 'update({ data: { isPatron: ... } })'
                  expect(content).not.toMatch(/data:\s*{\s*isPatron:/);
                  expect(content).not.toMatch(/isPatron:\s*{\s*set:/);
              }
          });
      };

      checkDir(moduleDir);
  });
});
