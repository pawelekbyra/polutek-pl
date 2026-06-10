import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listEmailTemplates } from '@/lib/modules/email/application/list-email-templates.use-case';
import { getEmailTemplate } from '@/lib/modules/email/application/get-email-template.use-case';
import { upsertEmailTemplate } from '@/lib/modules/email/application/upsert-email-template.use-case';
import { deleteEmailTemplate } from '@/lib/modules/email/application/delete-email-template.use-case';
import { AppContext } from '../../shared/app-context';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS } from '@/lib/email-defaults';

const mockPrisma = {
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

const mockCtx = {
  prisma: mockPrisma,
  actor: { type: 'admin', userId: 'admin-1' },
} as unknown as AppContext;

describe('Email Templates Use Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listEmailTemplates', () => {
    it('should return combined list of DB templates and missing system defaults', async () => {
      mockPrisma.emailTemplate.findMany.mockResolvedValue([
        { slug: 'custom-template', category: 'OTHER' }
      ]);

      const result = await listEmailTemplates(mockCtx);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.find(t => t.slug === 'custom-template')).toBeDefined();
        expect(result.data.find(t => t.slug === SYSTEM_TEMPLATE_SLUGS[0])).toBeDefined();
        expect(result.data.length).toBe(1 + SYSTEM_TEMPLATE_SLUGS.length);
      }
    });
  });

  describe('getEmailTemplate', () => {
    it('should return template from DB if it exists', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({ slug: 'test-slug', subject: 'Test' });

      const result = await getEmailTemplate(mockCtx, 'test-slug');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.slug).toBe('test-slug');
        expect((result.data as any).subject).toBe('Test');
      }
    });

    it('should return system default if not in DB', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      const sysSlug = SYSTEM_TEMPLATE_SLUGS[0];

      const result = await getEmailTemplate(mockCtx, sysSlug);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.slug).toBe(sysSlug);
        expect((result.data as any).subject).toBe(EMAIL_DEFAULTS[sysSlug].subject);
      }
    });
  });

  describe('upsertEmailTemplate', () => {
    it('should sanitize HTML and call repository upsert', async () => {
      const input = {
        slug: 'test-slug',
        subject: 'Subject',
        html: '<p>Hello <script>alert(1)</script></p>',
      };
      mockPrisma.emailTemplate.upsert.mockResolvedValue({ id: '1', ...input, html: '<p>Hello </p>' });

      const result = await upsertEmailTemplate(mockCtx, input);

      expect(result.ok).toBe(true);
      expect(mockPrisma.emailTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { slug: 'test-slug' },
        create: expect.objectContaining({
            html: '<p>Hello </p>'
        })
      }));
    });
  });

  describe('deleteEmailTemplate', () => {
    it('should fail if system template', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({ slug: 'sys', isSystem: true });

      const result = await deleteEmailTemplate(mockCtx, 'sys');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Cannot delete system template');
      }
    });

    it('should delete if custom template', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({ id: '1', slug: 'custom', isSystem: false });

      const result = await deleteEmailTemplate(mockCtx, 'custom');

      expect(result.ok).toBe(true);
      expect(mockPrisma.emailTemplate.delete).toHaveBeenCalledWith({ where: { slug: 'custom' } });
    });
  });
});
