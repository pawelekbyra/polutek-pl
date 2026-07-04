# Polutek.pl

Polutek.pl to aktywny produkt VOD jednego twórcy: jedno oficjalne miejsce,
jeden katalog wideo, jeden system wsparcia i dostępu, jedna społeczność,
jedna lista mailingowa oraz jeden kokpit admina.

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

Widzowie oglądają filmy w trzech poziomach dostępu (PUBLIC / LOGGED_IN /
PATRON), a jednorazowy napiwek Stripe powyżej progu nadaje dożywotni status
patrona (`PatronGrant`). Brak subskrypcji cyklicznych, brak multi-tenant.

## Aktualny stan

Fundamenty runtime są po stabilizacji: `PatronGrant` jest jedynym źródłem
prawdy dla statusu patrona, payment fulfillment idzie przez kanoniczny
`fulfillPayment()`, a playback prywatny/patroński jest bramkowany przez
backendowy `PlaybackPlan`. Produkcyjny launch nadal wymaga dowodów
operacyjnych, decyzji owner/legal i manualnego smoke testu zgodnie z
`DEPLOY_CHECKLIST.md` oraz issue #1269.

Wykonywalna kolejka kodowa żyje w `docs/tickets/ready/`. Zamknięte lub
zdezaktualizowane tickety/issue należy zamykać albo aktualizować przy każdej
większej zmianie stanu — dokumentacja ma opisywać stan obecny, nie historię.

## Stack

Next.js 15 (App Router, Vercel) · Neon PostgreSQL + Prisma · Clerk
(tożsamość) · Stripe (płatności) · Cloudflare Stream (wideo) · Resend
(email) · Upstash Redis (rate limiting).

## Szybki start

```bash
npm install
cp .env.example .env   # uzupełnij wartości
npx prisma generate
npm run dev
```

Testy i jakość (to samo co bramki CI):

```bash
npx vitest run                                # testy jednostkowe
npx tsc -p tsconfig.typecheck.json --noEmit   # typecheck
npm run quality:hotspots                      # budżety rozmiaru plików
```

## Dokumentacja

- **[`CLAUDE.md`](CLAUDE.md)** — przewodnik po kodzie: moduły, krytyczne
  inwarianty, czego nie robić. Czytaj przed każdą zmianą.
- **[`docs/README.md`](docs/README.md)** — indeks dokumentacji produktu
  (architektura, specyfikacje, runbooki, audyty, decyzje właściciela).
- **[`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md)** — znane ograniczenia
  i sufit skalowalności.
- Otwarte zadania: [`docs/tickets/ready/`](docs/tickets/ready/).

## Kierunki produktowe

- Multi-source video: pełny system admin create/edit + provider switch +
  playback end-to-end. Providerzy projektowani rozszerzalnie (Cloudflare
  Stream, YouTube, strategicznie Mux, dalej R2 i Vimeo).
- Player nie zna szczegółów providerów — renderuje zunifikowany playback
  plan z backendu.
- Strefa podziękowań dla patronów jest bonusem za wsparcie, nie „zakupem
  płatnej treści".
- Napisy PL/EN per film przez WebVTT (opcjonalny feature accessibility).

## Operacje: Cloudflare Stream signed playback

Playback prywatnych/patrońskich materiałów Cloudflare Stream używa lokalnie
generowanych signed playback tokenów; viewer hot path nie woła Cloudflare
Admin API per widz. Wymagane env: signing key + TTL tokenów (sekretów nie
logować i nie wklejać do issue/PR). Brak signing key = fail-closed (backend
nie zwraca źródła odtwarzania). Po rotacji klucza zaktualizuj env w
środowiskach produkcyjnych i preview.

## Zasady zmian

- Małe, izolowane zmiany; każda przechodzi pełne CI.
- Krytyczne inwarianty z CLAUDE.md §4 są nienegocjowalne.
- Status patrona, płatności i dostęp do wideo zmienia się wyłącznie przez
  kanoniczne use-case'y — nigdy bezpośrednimi zapisami do bazy.
- Dokumentacja opisuje stan obecny; historia żyje w git, nie w plikach.
