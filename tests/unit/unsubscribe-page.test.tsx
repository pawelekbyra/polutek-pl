import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { userFindUnique } = vi.hoisted(() => ({ userFindUnique: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: userFindUnique } } }));

import UnsubscribePage from '@/app/unsubscribe/page';
import { createContentUnsubscribeToken } from '@/lib/modules/subscriptions';

const ORIGINAL_ENV = { ...process.env };

async function render(params: Record<string, string>) {
  const element = await UnsubscribePage({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(element);
}

describe('/unsubscribe page', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, EMAIL_UNSUBSCRIBE_SIGNING_SECRET: 'a'.repeat(32) };
    userFindUnique.mockReset();
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('asks for confirmation in the recipient language and changes nothing on open', async () => {
    userFindUnique.mockResolvedValue({ language: 'en' });
    const html = await render({ token: createContentUnsubscribeToken('user_1')! });
    expect(html).toContain('Unsubscribe from notifications');
    expect(html).not.toContain('Wypisz się z powiadomień');
    expect(html).toContain('action="/api/subscriptions/unsubscribe"');
    expect(html).toContain('method="post"');
  });

  it('explains a broken link in Polish and English (owner unknown) and offers no button', async () => {
    const html = await render({ token: 'broken' });
    expect(html).toContain('Ten link nie działa');
    expect(html).toContain('This link does not work');
    expect(html).toContain('mailto:support@pawelperfect.com');
    expect(html).not.toContain('<form');
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('confirms the unsubscribe in the language passed back by the endpoint', async () => {
    const html = await render({ status: 'done', lang: 'pl' });
    expect(html).toContain('Wypisano');
    expect(html).not.toContain('Unsubscribed');
  });
});
