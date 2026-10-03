import type { Metadata } from 'next';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { SignedContentUnsubscribeUseCase, type UnsubscribeLanguage } from '@/lib/modules/subscriptions';
import { UNSUBSCRIBE_COPY, type UnsubscribeView } from './copy';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Powiadomienia e-mail / Email notifications',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type SearchParams = { token?: string; status?: string; lang?: string };

type UnsubscribePageProps = {
  searchParams?: Promise<SearchParams>;
};

const SUPPORT_EMAIL = 'support@pawelperfect.com';

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

/**
 * Target of every unsubscribe link in our mails (and of a GET on the List-Unsubscribe URL).
 * Opening the page changes nothing (link scanners open every URL); the button posts to
 * /api/subscriptions/unsubscribe, which sends the browser back here with the result.
 * The page talks in the recipient's language (User.language of the token's owner); when the
 * owner is unknown it shows Polish and English together.
 */
export default async function UnsubscribePage(props: UnsubscribePageProps) {
  const params = (await props.searchParams) ?? {};
  const token = asString(params.token);
  const status = asString(params.status);

  let view: UnsubscribeView;
  let language: UnsubscribeLanguage | null = null;

  if (status === 'done') {
    view = 'done';
    language = params.lang === 'en' ? 'en' : params.lang === 'pl' ? 'pl' : null;
  } else if (status === 'invalid') {
    view = 'invalid';
  } else {
    const ctx = createAppContext({ actor: { type: 'guest' } });
    const inspected = await SignedContentUnsubscribeUseCase.inspect(ctx, token);
    view = inspected.valid ? (status === 'error' ? 'error' : 'confirm') : 'invalid';
    language = inspected.language;
  }

  const languages: UnsubscribeLanguage[] = language ? [language] : ['pl', 'en'];

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-6 py-7 shadow-[0_20px_50px_rgba(23,23,23,0.10)]">
        {languages.map((lang) => {
          const copy = UNSUBSCRIBE_COPY[lang][view];
          return (
            <section key={lang} lang={lang} className="space-y-3">
              <h1 className="font-brand text-xl font-bold text-[var(--chan-ink)]">{copy.title}</h1>
              <p className="text-[14px] leading-relaxed text-[var(--chan-body)]">{copy.body}</p>
              {copy.help ? (
                <p className="text-[13px] leading-relaxed text-[var(--chan-body)]">
                  {copy.help}{' '}
                  <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                </p>
              ) : null}
            </section>
          );
        })}

        {view === 'confirm' || view === 'error' ? (
          <form action="/api/subscriptions/unsubscribe" method="post">
            <input type="hidden" name="token" value={token} />
            <button className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background" type="submit">
              {languages.map((lang) => UNSUBSCRIBE_COPY[lang].confirm.button).join(' / ')}
            </button>
          </form>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="inline-block text-sm font-semibold text-[var(--chan-ink)] underline">
          {languages.map((lang) => UNSUBSCRIBE_COPY[lang].home).join(' / ')}
        </a>
      </div>
    </main>
  );
}
