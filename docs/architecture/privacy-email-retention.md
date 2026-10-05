# Prywatność, retencja i e-mail

Stan 2026-10-05. Kod: `lib/modules/privacy/`, `lib/modules/email/`, `lib/email-defaults.ts`, `lib/modules/subscriptions/`. Telemetria: `admin-telemetry.md`. Konfiguracja poczty i DNS: `../operations/EMAIL_SETUP.md`,
`../operations/EMAIL_DELIVERABILITY.md`.

## Retencja i skróty IP

- `/api/cron/prune-expired-auth` (codziennie) kasuje wygasłe `Session` i `Verification`. `/api/cron/prune-unverified-accounts` kasuje po 7 dniach nigdy niezweryfikowane konta hasłowe.
- `/api/cron/retention` (codziennie) czyści IP i user agent (oraz ich skróty) starsze niż `TECHNICAL_DATA_RETENTION_DAYS` (90, `lib/modules/privacy/domain/retention.ts`; podane w Polityce prywatności i sprawdzane przez
  `legal-docs-consistency.test.ts`) w `AuditLog`, `Session`, `VideoPlaybackSession`, `VideoView`, bez kasowania wierszy. Ponawia też usuwanie kontaktów w Resend (`processContactRemovals()`).
- Skróty IP i UA to HMAC (`clientFingerprint` w `lib/modules/privacy`), klucz `IP_HASH_SECRET` (zalecany, ≥ 32 znaki) albo wyprowadzony z `BETTER_AUTH_SECRET`.
- `/api/cron/prune-playback-sessions`: sesje odtwarzania starsze niż 30 dni niezaliczone jako wyświetlenie (podgrzewanie planów tworzy je dla każdego rozgrzanego filmu, więc tabela rośnie z ruchem).
  `VideoPlaybackEvent.session` ma `onDelete: SetNull`. Zadania cykliczne: `../operations/SERWEREK.md` rozdz. 8.
- Własna telemetria jest anonimowa i bez cookies (`CLAUDE.md` §4.19): nigdy nie dodawaj do niej identyfikatora użytkownika, surowego IP/UA, cookie ani magazynu urządzenia.
- Usunięcie konta (`DELETE /api/user/account`): własne anonimizujące czyszczenie, potem kasowanie wierszy sesji/kont/dwuskładnikowych/kluczy dostępu; wiersz `User` zostaje jako nagrobek (`deleted_…@deleted.invalid`) i nie może się zalogować.
  Czyszczenie kasuje tekst i obraz wszystkich komentarzy użytkownika (wiersze zostają jako usunięte przez autora, wątki całe), usuwa adres z `BroadcastEmailRecipient`/`EmailEvent` (oczekujące rozsyłki → `SKIPPED`)
  i kolejkuje kontakt Resend w `ResendContactRemoval` (próba od razu z limitem 5 s, potem ponawia `/api/cron/retention`). Wiersze `Payment` i `AuditLog` zostają.

## E-mail

- **Teksty maili systemowych są w kodzie** (`lib/email-defaults.ts`, zmienne w `lib/modules/email/domain/email-template-registry.ts`). Nic nie zasiewa `EmailTemplate`; wiersz systemowy jest używany tylko, gdy ma `customizedAt`
  (administrator zapisał go w panelu); „Przywróć domyślny” kasuje wiersz. Nigdy nie zapisuj tekstów domyślnych do bazy. Zapisany w bazie szablon ma pierwszeństwo przed domyślnym.
- **Jeden transport:** `sendEmail()` w `lib/modules/email/infrastructure/resend-email.transport.ts` (wrapper, zwykły tekst, Reply-To, tagi `app=pawelperfect` + `kind`). Wartości szablonu są escapowane (`render-email.ts`),
  nieznane zmienne są odrzucane przy zapisie. Nadawca: `Pawel Perfect <no-reply@pawelperfect.com>`.
- **Wypisanie:** podpisane tokeny nigdy nie wygasają (`EMAIL_UNSUBSCRIBE_SIGNING_SECRET`, `_PREVIOUS` przy rotacji). Strona `/unsubscribe` (bez prefiksu języka) i jednoklikowe `POST /api/subscriptions/unsubscribe?token=` (RFC 8058).
  Link/nagłówki mają tylko mail powitalny i rozsyłki; maile bezpieczeństwa i płatności nigdy.
- **Rozsyłki** to kolejka w Postgresie: panel tylko tworzy `BroadcastEmail` + odbiorców `PENDING` (idempotentny `requestKey`, jedna aktywna rozsyłka); `/api/cron/send-broadcasts` (timer co minutę) wysyła ≤ 4/s z kluczem idempotencji
  Resend na odbiorcę, wstrzymuje się przy 429. Odbiorcy: subskrybenci ze zgodą na powiadomienia o treści, których nie ma w `EmailSuppression`; jedna grupa odbiorców (`broadcast-audience.ts`), brak segmentu wspierających
  (profilowanie po płatnościach). Obowiązkowa stopka z wypisaniem. Nigdy nie wysyłaj rozsyłek w żądaniu HTTP.
- **Webhook** `/api/webhooks/resend`: weryfikowany `resend.webhooks.verify` (odrzucenia z powodem w logu); reaguje tylko na zdarzenia maili z tagiem `app=pawelperfect` (konto Resend jest wspólne z PP Support).
  Poczta przychodząca nie jest obsługiwana tutaj (MX to Cloudflare → PP Support).
- Zmiennymi `{{firstName}}` i `{{preferencesLink}}` (podpisana strona `/unsubscribe`) wypełnia serwer; maile `welcome-email`, `become-patron` i `thank-you-donation` nie obiecują dostępu za napiwek.
