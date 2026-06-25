import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin navigation breadcrumbs', () => {
  it('provides a shared breadcrumb/back-link primitive for maintained admin screens', () => {
    const source = read('app/admin/components/AdminBreadcrumbs.tsx');

    expect(source).toContain('aria-label="Ścieżka administracyjna"');
    expect(source).toContain('Wróć do panelu');
    expect(source).toContain('href={resolvedBackHref}');
  });

  it('uses breadcrumbs on maintained admin section and subsection pages', () => {
    const maintainedPages = [
      'app/admin/comments/page.tsx',
      'app/admin/comments/reports/page.tsx',
      'app/admin/channel/ChannelSettingsForm.tsx',
      'app/admin/emails/page.tsx',
      'app/admin/payments/PaymentSettingsForm.tsx',
      'app/admin/users/page.tsx',
      'app/admin/users/dashboard/page.tsx',
      'app/admin/users/payments/page.tsx',
      'app/admin/users/[userId]/page.tsx',
      'app/admin/videos/components/AdminVideoHeader.tsx',
      'app/admin/videos/[id]/page.tsx',
      'app/admin/videos/layout/page.tsx',
    ];

    for (const page of maintainedPages) {
      expect(read(page), page).toContain('AdminBreadcrumbs');
    }
  });

  it('keeps prior admin cleanup guarantees intact', () => {
    const adminSources = [
      'app/admin/videos/layout/page.tsx',
      'app/admin/videos/page.tsx',
      'app/admin/emails/TemplatesList.tsx',
      'app/admin/emails/components/BroadcastWizard.tsx',
      'app/admin/emails/broadcast/BroadcastEmailForm.tsx',
    ].map(read).join('\n');

    expect(adminSources).not.toMatch(/confirm\(|window\.confirm/);
    expect(read('app/admin/videos/layout/page.tsx')).toContain('ArrowUp');
    expect(read('app/admin/videos/layout/page.tsx')).toContain('ArrowDown');
    expect(read('app/admin/videos/layout/page.tsx')).not.toContain('GripVertical');
  });
});
