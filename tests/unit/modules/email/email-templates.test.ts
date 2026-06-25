import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import {
  listEmailTemplates,
  getEmailTemplateBySlug,
  upsertEmailTemplate,
  deleteEmailTemplate
} from '@/lib/modules/email';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS } from '@/lib/email-defaults';

describe('Email Templates Use Cases', () => {
  const prismaMock = {
    emailTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const ctx = createAppContext({
    prisma: prismaMock as any,
    actor: { type: 'admin', userId: 'admin_1' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEmailTemplates', () => {
    it('returns templates from DB and missing system defaults', async () => {
      prismaMock.emailTemplate.findMany.mockResolvedValue([
        { slug: 'welcome-email', isSystem: true, subject: 'Custom Welcome', html: 'Custom HTML' }
      ]);

      const result = await listEmailTemplates(ctx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should have custom welcome + other system defaults
        expect(result.data.find(t => t.slug === 'welcome-email')?.subject).toBe('Custom Welcome');
        expect(result.data.length).toBeGreaterThanOrEqual(SYSTEM_TEMPLATE_SLUGS.length);
        expect(result.data.find(t => t.slug === 'account-deleted')?.subject).toBe(EMAIL_DEFAULTS['account-deleted'].subject);
      }
    });
  });

  describe('getEmailTemplateBySlug', () => {
    it('returns template from DB if exists', async () => {
      prismaMock.emailTemplate.findUnique.mockResolvedValue({ slug: 'test-template', subject: 'Test' });

      const result = await getEmailTemplateBySlug(ctx, 'test-template');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.subject).toBe('Test');
      }
    });

    it('returns system default if not in DB', async () => {
      prismaMock.emailTemplate.findUnique.mockResolvedValue(null);

      const result = await getEmailTemplateBySlug(ctx, 'welcome-email');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.slug).toBe('welcome-email');
        expect(result.data.subject).toBe(EMAIL_DEFAULTS['welcome-email'].subject);
      }
    });

    it('returns error if not found and not system', async () => {
      prismaMock.emailTemplate.findUnique.mockResolvedValue(null);

      const result = await getEmailTemplateBySlug(ctx, 'non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_TEMPLATE_NOT_FOUND');
      }
    });
  });

  describe('upsertEmailTemplate', () => {
    it('sanitizes HTML and saves template', async () => {
      prismaMock.emailTemplate.upsert.mockResolvedValue({ id: '1', slug: 'test', subject: 'S', html: 'clean' });
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await upsertEmailTemplate(ctx, {
        slug: 'test',
        subject: 'S',
        html: '<script>alert(1)</script><p>Hello</p>',
      });

      expect(result.ok).toBe(true);
      expect(prismaMock.emailTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          html: '<p>Hello</p>'
        })
      }));
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('deleteEmailTemplate', () => {
    it('deletes non-system template', async () => {
      prismaMock.emailTemplate.findUnique.mockResolvedValue({ id: '1', slug: 'test', isSystem: false });
      prismaMock.emailTemplate.delete.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await deleteEmailTemplate(ctx, 'test');

      expect(result.ok).toBe(true);
      expect(prismaMock.emailTemplate.delete).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });

    it('refuses to delete system template', async () => {
      prismaMock.emailTemplate.findUnique.mockResolvedValue({ id: '1', slug: 'welcome-email', isSystem: true });

      const result = await deleteEmailTemplate(ctx, 'welcome-email');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EMAIL_SYSTEM_TEMPLATE_DELETE_FORBIDDEN');
      }
    });
  });
});

describe('ensureRequiredEmailTemplates', () => {
  it('creates all required slugs when none exist', async () => {
    const { ensureRequiredEmailTemplates } = await import('@/scripts/ensure-required-emails');
    const emailTemplate = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    };

    const result = await ensureRequiredEmailTemplates(emailTemplate as any);

    expect(result.created).toEqual([...SYSTEM_TEMPLATE_SLUGS]);
    expect(emailTemplate.create).toHaveBeenCalledTimes(SYSTEM_TEMPLATE_SLUGS.length);
    for (const slug of SYSTEM_TEMPLATE_SLUGS) {
      expect(emailTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug,
          isSystem: true,
          isActive: true,
          subject: EMAIL_DEFAULTS[slug].subject,
          html: EMAIL_DEFAULTS[slug].html,
        }),
      });
    }
  });

  it('is idempotent and does not overwrite existing templates', async () => {
    const { ensureRequiredEmailTemplates } = await import('@/scripts/ensure-required-emails');
    const emailTemplate = {
      findUnique: vi.fn().mockResolvedValue({ id: 'existing-template' }),
      create: vi.fn(),
    };

    const result = await ensureRequiredEmailTemplates(emailTemplate as any);

    expect(result.existing).toEqual([...SYSTEM_TEMPLATE_SLUGS]);
    expect(result.created).toEqual([]);
    expect(emailTemplate.create).not.toHaveBeenCalled();
  });
});
