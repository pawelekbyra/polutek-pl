# pawelperfect.com

Jednokanałowa platforma wideo jednego twórcy: <https://www.pawelperfect.com>.

- Serwis jest niekomercyjny. Filmy są darmowe: część publiczna, część po założeniu darmowego konta.
- Wsparcie to dobrowolny napiwek przez Stripe. Niczego nie odblokowuje.
- Komentarze czytają wszyscy; pisanie i reakcje wymagają konta.

## Stos

Next.js 16 (App Router), React 19, TypeScript, Prisma, PostgreSQL 17, Better Auth, Stripe, Amazon SES.
Wideo: własny HLS (oryginały i rendycje w prywatnych bucketach Cloudflare R2, kodowanie we własnym
kontenerze, dostarczanie przez Cloudflare Worker). Hosting: jeden serwer Hetzner, Docker Compose,
Cloudflare Tunnel.

## Dokumentacja

| Co | Gdzie |
|---|---|
| Przewodnik dla agentów AI i zasady, których nie wolno łamać | [`CLAUDE.md`](CLAUDE.md) |
| Indeks dokumentacji | [`docs/README.md`](docs/README.md) |
| Otwarte prace i decyzje do podjęcia | [`docs/operations/STATUS.md`](docs/operations/STATUS.md) |
| Serwer, deploy, kopie zapasowe | [`docs/operations/SERWEREK.md`](docs/operations/SERWEREK.md) |

## Praca lokalna

```bash
npm ci
cp .env.example .env   # uzupełnij wartości
npx prisma generate
npm run dev
```

Sprawdzenia przed scaleniem: `npm run quality` (architektura, typecheck, testy), `npm run quality:hotspots`,
`node scripts/ops/local-ci.mjs` (`docs/operations/LOCAL-CI.md`). Repozytorium jest lokalne (serwer TAKT), bez GitHuba.
Wdrożenie na serwer tylko na zgodę właściciela: `docs/operations/SERWEREK.md`, rozdział „Wdrożenie”.
