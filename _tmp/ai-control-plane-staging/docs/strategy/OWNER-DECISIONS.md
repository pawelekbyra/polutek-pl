# Owner Decisions

Status: STAGED ONLY — NIEAKTYWNE.

Decyzje właściciela, wiążące dopóki właściciel jawnie ich nie zmieni:

- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony lub cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta; domyślne wartości launch: 10 PLN, 10 USD, 10 EUR, 10 CHF.
- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma być wspierany projektowo per `VideoAsset`, bez budowania ciężkiego enterprise multi-provider frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Komentarze pod patron-only wideo są widoczne dla wszystkich; komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Launch jest publiczny, nie prywatna beta.
- Cel jakości: produkt excellent, nie szybkie minimum; excellence osiągane fazami i ticketami, nie jednym wielkim PR-em.

## Decision log rules

- Builder nie może zmienić product policy.
- Planner może zaproponować pytanie do właściciela.
- Integrator zapisuje zaakceptowaną decyzję jako osobny owner-decision entry.
- Certifier sprawdza, czy specs i tickety respektują decyzje.

## Otwarte pytania właściciela po aktywacji

- Polityka partial refund: czy częściowy refund redukuje/oznacza grant, czy pozostaje manual review?
- Czy reakcje/hearts w komentarzach są launch-critical, jeśli obecny runtime je posiada?
- Jakie dokładnie PL/EN legal/cookie copy ma być użyte przed X7?
- Jakie limity rate limiting dla komentarzy i broadcastów są akceptowalne na launch?
