# Owner Decisions

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Obowiązujące decyzje właściciela

Decyzje obowiązujące dopóki właściciel jawnie ich nie zmieni. Szczegóły techniczne i operacyjne dotyczące launchu zostały skonsolidowane w: [docs/strategy/OWNER-LAUNCH-DECISIONS-001.md](OWNER-LAUNCH-DECISIONS-001.md).

### Product identity

- Polutek.pl nie jest platformą, marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.
- Polutek.pl jest osobistym serwisem jednego twórcy i jednej społeczności: Paweł Perfect.
- Zdanie rdzeniowe: `Polutek.pl is not a platform. Polutek.pl is a place.`

### Patronat / payments / access

- Patronat nie jest subskrypcją cykliczną; jest nagrodą za dobrowolne, jednorazowe wsparcie (napiwek).
- Dostęp patrona nie wygasa z upływem czasu i nie wymaga kolejnych wpłat (lifetime tak długo, jak serwis istnieje).
- Próg kwalifikującego wsparcia (napiwku): min. 10 jednostek aktywnej waluty (PLN, USD, EUR, CHF, GBP).
- Active `PatronGrant` jest backendowym źródłem prawdy dla dostępu.
- Pełny refund cofa powiązany grant; dispute zawiesza; dispute won reactivates; dispute lost/chargeback revokes.
- Brak standardowych częściowych zwrotów (unexpected partial refund wymaga manual review).

### Video / playback

- Cloudflare Stream jest aktywnym providerem playbacku.
- Prywatne oryginały muszą istnieć poza Cloudflare; Cloudflare nie jest jedyną kopią.
- Dla denied/locked playback: nie montować realnego playera, nie pobierać streamu, nie żądać tokenu.

### Comments / community

- Strefa Patrona jest moderowaną społecznością.
- Właściciel może usuwać komentarze lub cofać dostęp z ważnej przyczyny (spam, nękanie, treści bezprawne).
- Reakcje/hearts nie są launch-critical i mogą zostać odłożone.

### Email / subscriptions

- Trzy klasy maili: System/Transactional, Content Notifications, Referral Notifications.
- Systemowy mail nie może automatycznie dodawać do Resend Audience ani włączać subskrypcji treści.
- Każdy wspierany mail systemowy ma edytowalny szablon PL/EN w panelu admina.
- Content notifications wymagają osobnego, świadomego opt-in (checkbox nie może być domyślnie zaznaczony).
- Link unsubscribe musi być bezpieczny (podpisany token) i nie zawierać e-maila w query string.

### Launch / quality

- Launch PL i EN (główny UX, płatności, Patron Zone, komentarze, kontakt, dokumenty).
- Minimalna macierz urządzeń i przeglądarek (X6) jest wymagana.
- Przed startem wymagany profesjonalny przegląd prawny (LEGAL_REVIEW_REQUIRED).
- Publiczny launch pozostaje: `NO_GO` do czasu certyfikacji X7.

### Ops / privacy

- RPO: 24h, RTO: 48h (cele wewnętrzne).
- Kanał alertów: `support@polutek.pl`.
- Brak modelu reklamowego, brak sprzedaży danych, brak profilowania.
- Kontakt: `support@polutek.pl`, adres do korespondencji: Złota 75A/7, 00-819 Warszawa.

## Resolved owner questions

| ID | Status | Decyzja |
| --- | --- | --- |
| OQ-001 | DECIDED | Brak standardowych partial refunds; unexpected partial refund -> manual review; full refund cofa grant. |
| OQ-002 | DECIDED | Reactions/hearts nie są launch-critical. |
| OQ-003 | OWNER_DIRECTION_DECIDED / LEGAL_COPY_PENDING | Filozofia i dane robocze ustalone; dokładne PL/EN legal copy wymaga profesjonalnego przeglądu i późniejszego ticketu. |
| OQ-004 | DECIDED / DELEGATED_TECHNICAL_THRESHOLD | Bezpieczne limity rate limiting dobiera implementacja w celu ochrony przed nadużyciem bez blokowania normalnego UX. |
| OQ-005 | DECIDED | Alert channel `support@polutek.pl`, RPO 24h, RTO 48h, progi techniczne delegowane do implementacji. |
| OQ-006 | DECIDED | Prywatne oryginały muszą istnieć poza Cloudflare; Cloudflare nie jest jedyną kopią. |
| OQ-007 | DECIDED_WITH_LEGAL_REVIEW_REQUIRED | PL+EN launch, minimalna macierz X6, brak reklam/profilowania; profesjonalny legal review pozostaje blockerem. |

## Decision log rules

- Builder nie może zmienić product policy ani rozwiązywać otwartych pytań właściciela samodzielnie.
- Planner może zaproponować pytanie do właściciela, ale musi oznaczyć je jako otwarte, dopóki właściciel nie podejmie decyzji.
- Integrator zapisuje zaakceptowaną decyzję jako osobny owner-decision entry i przenosi powiązane pytanie z tabeli otwartej do sekcji obowiązujących decyzji.
- Certifier sprawdza, czy specs, tickety i implementacja respektują obowiązujące decyzje oraz nie traktują otwartych pytań jako rozstrzygniętych.
- Każda zmiana obowiązującej decyzji wymaga jawnej decyzji właściciela albo ticketu, który jednoznacznie taką decyzję zawiera.
