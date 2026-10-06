import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail: emailsSend, close: vi.fn() })) } }));
vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { derivePreheader, htmlToPlainText, wrapEmailDocument } from '@/lib/modules/email/domain/email-content';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS } from '@/lib/email-defaults';
import {
  EMAIL_IDENTITY_LINE,
  sendEmail,
} from '@/lib/modules/email/infrastructure/email.transport';

describe('htmlToPlainText', () => {
  it('keeps link targets visible and turns blocks into lines', () => {
    const text = htmlToPlainText(
      '<h1>Confirm</h1><p>Hi &amp; welcome</p><a href="https://x.test/a?b=1&amp;c=2" style="x">Go &rarr;</a>',
    );
    expect(text).toContain('Confirm');
    expect(text).toContain('Hi & welcome');
    expect(text).toContain('Go ->\nhttps://x.test/a?b=1&c=2');
    expect(text).not.toMatch(/<|&amp;/);
  });

  it('drops head/style content', () => {
    expect(htmlToPlainText('<head><title>T</title></head><style>p{}</style><p>Body</p>')).toBe('Body');
  });
});

describe('wrapEmailDocument', () => {
  const base = { language: 'en' as const, title: 'Subject', identityLine: 'Sender line' };

  it('adds doctype, lang, title, hidden preheader and the identity line', () => {
    const out = wrapEmailDocument({ ...base, html: '<div><p>First paragraph.</p></div>' });
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('<title>Subject</title>');
    expect(out).toContain('First paragraph.');
    expect(out).toContain('display:none');
    expect(out).toContain('Sender line');
  });

  it('leaves a full document untouched', () => {
    const doc = '<html><body>x</body></html>';
    expect(wrapEmailDocument({ ...base, html: doc })).toBe(doc);
  });

  it('keeps the hidden preheader out of the plain-text part', () => {
    const out = wrapEmailDocument({ ...base, html: '<div><p>First paragraph.</p><p>Second.</p></div>' });
    const text = htmlToPlainText(out);
    expect(text.match(/First paragraph\./g)).toHaveLength(1);
    expect(text).not.toMatch(/zwnj|nbsp/);
    expect(text).toContain('Sender line');
  });

  it('truncates a long preheader', () => {
    expect(derivePreheader(`<p>${'a'.repeat(300)}</p>`).length).toBeLessThanOrEqual(110);
  });
});

describe('default templates are not shouty', () => {
  it.each(SYSTEM_TEMPLATE_SLUGS)('%s: calm subject, no all-caps styling, no domain in subject', (slug) => {
    const t = EMAIL_DEFAULTS[slug];
    for (const subject of [t.subject, t.subjectEn]) {
      expect(subject).not.toMatch(/www\.|\.com|\.pl|!|\{\{firstName\}\}/);
      expect(subject).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    for (const html of [t.html, t.htmlEn]) {
      expect(html).not.toContain('text-transform');
      expect(html).not.toContain('{{appName}}');
    }
  });
});

describe('the transport sends a deliverability-friendly message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SES_SMTP_USER = 'test_user';
    process.env.SES_SMTP_PASS = 'test_pass_1234';
    emailsSend.mockResolvedValue({ response: '250 Ok email_1', messageId: '<local@x>' });
  });

  it('sends multipart text + full HTML with Auto-Submitted and a unique X-Entity-Ref-ID, no List-Unsubscribe on security mail', async () => {
    await sendEmail({
      to: 'a@example.com',
      subject: 'Confirm your email address',
      html: '<div><h1>Confirm</h1><p>Click.</p><a href="https://x.test/v">Confirm email</a></div>',
      language: 'en',
      kind: 'verify-email',
    });
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', language: 'pl', kind: 'password-changed' });

    const [first, second] = emailsSend.mock.calls.map((c) => c[0]);
    expect(first.html).toContain('<!DOCTYPE html>');
    expect(first.html).toContain('<html lang="en">');
    expect(first.html).toContain(EMAIL_IDENTITY_LINE);
    expect(first.text).toContain('https://x.test/v');
    expect(first.text).not.toContain('<');
    expect(first.headers['Auto-Submitted']).toBe('auto-generated');
    expect(first.headers['X-Entity-Ref-ID']).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers['X-Entity-Ref-ID']).not.toBe(second.headers['X-Entity-Ref-ID']);
    expect(first.headers['List-Unsubscribe']).toBeUndefined();
  });

  it('puts the mandatory footer into a complete HTML document an admin pasted', async () => {
    await sendEmail({
      to: 'a@example.com',
      subject: 's',
      html: '<html><body><p>Own layout</p></body></html>',
      language: 'pl',
      kind: 'broadcast',
      unsubscribe: { oneClickUrl: 'https://x.test/api/u?token=t', footerHtml: '<p>FOOTER</p>' },
    });
    expect(emailsSend.mock.calls[0][0].html).toBe('<html><body><p>Own layout</p><p>FOOTER</p>\n</body></html>');
  });
});

