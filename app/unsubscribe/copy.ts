import type { UnsubscribeLanguage } from '@/lib/modules/subscriptions';

export type UnsubscribeView = 'confirm' | 'done' | 'invalid' | 'error';

type ViewCopy = { title: string; body: string; help?: string };

export const UNSUBSCRIBE_COPY: Record<
  UnsubscribeLanguage,
  Record<UnsubscribeView, ViewCopy> & { confirm: ViewCopy & { button: string }; home: string }
> = {
  pl: {
    confirm: {
      title: 'Wypisz się z powiadomień',
      body: 'Przestaniemy wysyłać Ci e-maile o nowych filmach i treściach. Wiadomości związane z kontem (np. reset hasła) nadal będą przychodzić.',
      button: 'Wypisz mnie',
    },
    done: {
      title: 'Wypisano',
      body: 'Nie będziesz już dostawać e-maili o nowych treściach. Jeśli zmienisz zdanie, kliknij ponownie „Subskrajb” na stronie.',
    },
    invalid: {
      title: 'Ten link nie działa',
      body: 'Link jest niepełny albo uszkodzony (zdarza się, gdy program pocztowy go przytnie). Skopiuj cały link z wiadomości albo napisz do nas, a wypiszemy Cię ręcznie.',
      help: 'Kontakt:',
    },
    error: {
      title: 'Nie udało się wypisać',
      body: 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.',
      help: 'Jeśli to się powtarza, napisz do nas:',
    },
    home: 'Strona główna',
  },
  en: {
    confirm: {
      title: 'Unsubscribe from notifications',
      body: 'We will stop sending you emails about new videos and content. Account messages (such as password resets) will still arrive.',
      button: 'Unsubscribe me',
    },
    done: {
      title: 'Unsubscribed',
      body: 'You will no longer receive emails about new content. If you change your mind, click “Subscribe” on the site again.',
    },
    invalid: {
      title: 'This link does not work',
      body: 'The link is incomplete or damaged (mail apps sometimes cut it). Copy the whole link from the message, or write to us and we will unsubscribe you by hand.',
      help: 'Contact:',
    },
    error: {
      title: 'Could not unsubscribe',
      body: 'Something went wrong on our side. Please try again in a moment.',
      help: 'If it keeps happening, write to us:',
    },
    home: 'Home page',
  },
};
