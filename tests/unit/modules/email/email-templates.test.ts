import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import {
  deleteEmailTemplate,
  getEmailTemplateBySlug,
  listEmailTemplates,
  upsertEmailTemplate,
} from '@/lib/modules/email';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS } from '@/lib/email-defaults';

type Row = {
  id: string;
  slug: string;
  name: string | null;
  description: string | null;
  isSystem: boolean;
  subject: string;
  html: string;
  subjectEn: string | null;
  htmlEn: string | null;
  customizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeDb(rows: Row[] = []) {
  const table = rows.map((r) => ({ ...r }));
  const emailTemplate = {
    findMany: vi.fn(async () => table),
    findUnique: vi.fn(async ({ where }: any) => table.find((r) => r.slug === where.slug) ?? null),
    upsert: vi.fn(async ({ where, update, create }: any) => {
      const existing = table.find((r) => r.slug === where.slug);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { id: `id-${where.slug}`, createdAt: new Date(), updatedAt: new Date(), ...create };
      table.push(row);
      return row;
    }),
    delete: vi.fn(async ({ where }: any) => {
      table.splice(table.findIndex((r) => r.slug === where.slug), 1);
    }),
  };
  return { db: { emailTemplate, auditLog: { create: vi.fn() } }, table };
}

function ctxFor(db: any) {
  return createAppContext({ prisma: db, actor: { type: 'admin', userId: 'admin_1' }, now: () => new Date('2026-10-03T12:00:00Z') } as any);
}

const seeded = (slug: string, subject: string): Row => ({
  id: `seed-${slug}`,
  slug,
  name: 'System: x',
  description: null,
  isSystem: true,
  subject,
  html: '<p>old seeded text: Strefa Patrona za napiwek</p>',
  subjectEn: null,
  htmlEn: null,
  customizedAt: null,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-01T00:00:00Z'),
});

describe('email templates: one source of truth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists every system mail with its code default when no admin saved it, even if an old seeded row exists', async () => {
    const { db } = makeDb([seeded('welcome-email', 'Old seeded subject')]);
    const result = await listEmailTemplates(ctxFor(db));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const system = result.data.filter((t) => t.isSystem);
    expect(system.map((t) => t.slug)).toEqual([...SYSTEM_TEMPLATE_SLUGS]);
    const welcome = system.find((t) => t.slug === 'welcome-email')!;
    expect(welcome).toMatchObject({ isCustomized: false, subject: EMAIL_DEFAULTS['welcome-email'].subject });
    expect(welcome.variables.map((v) => v.key)).toContain('preferencesLink');
  });

  it('shows an admin override as customized, and own templates separately', async () => {
    const override = { ...seeded('verify-email', 'Admin subject'), html: '<a href="{{actionUrl}}">x</a>', customizedAt: new Date() };
    const own = { ...seeded('nowy-film', 'Promo'), isSystem: false, name: 'Nowy film', customizedAt: new Date() };
    const { db } = makeDb([override, own]);
    const result = await listEmailTemplates(ctxFor(db));
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.find((t) => t.slug === 'verify-email')).toMatchObject({ isCustomized: true, subject: 'Admin subject', name: 'Potwierdzenie e-maila' });
    expect(result.data.find((t) => t.slug === 'nowy-film')).toMatchObject({ isSystem: false, name: 'Nowy film' });
  });

  it('returns the default for a system slug and 404 for an unknown own template', async () => {
    const { db } = makeDb();
    const found = await getEmailTemplateBySlug(ctxFor(db), 'reset-password');
    expect(found.ok && found.data.subject).toBe(EMAIL_DEFAULTS['reset-password'].subject);
    const missing = await getEmailTemplateBySlug(ctxFor(db), 'does-not-exist');
    expect(!missing.ok && missing.error.statusCode).toBe(404);
  });

  it('saving marks the row as an admin override (customizedAt) and sanitizes the HTML', async () => {
    const { db, table } = makeDb();
    const result = await upsertEmailTemplate(ctxFor(db), {
      slug: 'welcome-email',
      subject: 'Cześć {{firstName}}',
      html: '<p>Hej {{firstName}}</p><script>alert(1)</script>',
    });
    expect(result.ok).toBe(true);
    expect(table[0]).toMatchObject({ slug: 'welcome-email', isSystem: true, customizedAt: new Date('2026-10-03T12:00:00Z') });
    expect(table[0].html).not.toContain('<script>');
  });

  it('refuses a variable the mail does not have, and a verification mail without its link', async () => {
    const { db, table } = makeDb();
    const unknown = await upsertEmailTemplate(ctxFor(db), { slug: 'welcome-email', subject: 'Hi', html: '<p>{{amount}} {{name}}</p>' });
    expect(!unknown.ok && unknown.error.code).toBe('EMAIL_TEMPLATE_INVALID_VARIABLES');
    expect(!unknown.ok && unknown.error.message).toContain('{{amount}}');

    const noLink = await upsertEmailTemplate(ctxFor(db), { slug: 'verify-email', subject: 'Confirm', html: '<p>Click here</p>' });
    expect(!noLink.ok && noLink.error.message).toContain('{{actionUrl}}');
    expect(table).toHaveLength(0);
  });

  it('deleting a system override restores the default; deleting an own template removes it', async () => {
    const { db, table } = makeDb([
      { ...seeded('welcome-email', 'Admin'), customizedAt: new Date() },
      { ...seeded('promo', 'Promo'), isSystem: false },
    ]);
    const restored = await deleteEmailTemplate(ctxFor(db), 'welcome-email');
    expect(restored.ok && restored.data.restoredDefault).toBe(true);
    const removed = await deleteEmailTemplate(ctxFor(db), 'promo');
    expect(removed.ok && removed.data.restoredDefault).toBe(false);
    expect(table).toHaveLength(0);

    const after = await getEmailTemplateBySlug(ctxFor(db), 'welcome-email');
    expect(after.ok && after.data.isCustomized).toBe(false);
  });
});
