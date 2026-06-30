# Audyt kodu — 2026-06-30

Audyt wykonany ręcznie przez czytanie plików źródłowych (nie dokumentacji).
Punktem wyjścia był PR #1272 (właśnie zmerżowany do main).

> **Ważne:** `docs/REFACTORING-ROADMAP.md` jest częściowo przestarzały — wiele problemów które opisuje zostało już naprawionych. Ten dokument zawiera stan faktyczny z kodu.

---

## 1. Co PR #1272 wniósł (już w main)

- Usunięcie pól `User.isPatron`, `User.patronSince`, `User.patronSource` z modelu User
- `PatronGrant` jest teraz jedynym źródłem prawdy dla dostępu patronackiego
- `recalculatePatronStatus()` to czyste odczytanie z PatronGrant — zero zapisów do User
- `PatronRepository.updateUserPatronFields` usunięte
- Polityka `/api/media` używa `isLegacyPrivatePlaybackFallbackAllowed()` zamiast surowego `process.env`
- Cron `/api/cron/stripe-reconciliation` (co 15 min) odzyskuje stuck PENDING payments przez `fulfillPayment()`
- Zarejestrowany w `vercel.json`
- Admin UX: tooltip Zarchiwizuj, badge raportów w komentarzach, `VideoFilters` z collapsible sekcją, nawigacja w edit page
- `CLAUDE.md` jako przewodnik dla agentów AI
- Migracja `20260630000000_remove_legacy_user_patron_cache` — dodana do bazy

---

## 2. Stan bezpieczeństwa API — zweryfikowany w kodzie

### ✅ Naprawione (roadmapa mówiła że jest problem — w kodzie już nie ma)

- **payment-settings route** (`app/api/admin/payment-settings/route.ts`) — ma `requireAdminForApi()` na początku GET i PATCH
- **payments route** (`app/api/admin/payments/route.ts`) — ma `requireAdminForApi()` na początku GET
- **`req.json()` bez try/catch** — wszystkie wywołania w trasach admin są wewnątrz try/catch
- **Redis failure w view counter** (`lib/modules/video/application/record-playback-event.use-case.ts:227-231`) — jest try/catch, przy awarii Redis przechodzi bez dedup zamiast rzucać 500

### ✅ Trasy admin bez `requireAdminForApi()` — tylko 2, oba bezpieczne

```
app/api/admin/settings/media/default-video-thumbnail/proxy/route.ts
  → Zwraca zawsze 404, nie przetwarza danych. Bezpieczne.

app/api/admin/creator/route.ts
  → @deprecated. Deleguje do canonicalGET/canonicalPATCH z ../channel/route.ts
  → channel/route.ts MA requireAdminForApi(). Bezpieczne przez delegację.
  → Nieczyste — brak własnego auth check — ale nie stanowi luki.
```

### ❌ Jedyny realny problem bezpieczeństwa

Jeden hardcoded `status: 500` zamiast dynamicznego statusu:
```
app/api/admin/comments/reports/[reportId]/resolve/route.ts:25
  return NextResponse.json({ error: result.error.message }, { status: 500 });
  → Powinno być: fromUseCaseResult(result)
```

---

## 3. Problemy do naprawienia — zweryfikowane w kodzie

### PROBLEM 1 — Bounce/complained NIE tłumią przyszłych emaili

**Plik:** `lib/modules/email/application/handle-resend-webhook.use-case.ts`

```
case 'email.bounced':
  await updateRecipientStatus(ctx, resendEmailId, 'BOUNCED', { bouncedAt: new Date() }, true);
  break;  // ← NIE woła handleUnsubscribe

case 'email.complained':
  await updateRecipientStatus(ctx, resendEmailId, 'COMPLAINED', { complainedAt: new Date() }, true);
  break;  // ← NIE woła handleUnsubscribe

case 'email.unsubscribed':
  await handleUnsubscribe(ctx, data.to?.[0]);  // ← jedyne miejsce które tłumi
  break;
```

`handleUnsubscribe()` (linia ~261) robi `emailPreference.upsert({ marketingEmails: false })`.
`EmailPolicy.canReceiveBroadcastEmail()` sprawdza `marketingEmails === true` przed wysłaniem.
Bez wywołania `handleUnsubscribe` przy bounce/complained — osoba z bouncem dostanie następny broadcast.

**Fix:** Dodać `await handleUnsubscribe(ctx, data.to?.[0]);` po `updateRecipientStatus` w obu case'ach bounce i complained.

---

### PROBLEM 2 — Typo widoczne dla użytkowników

**Plik:** `app/components/LanguageContext.tsx`, linie 76–79:
```ts
subscribe: 'Subskrajb',       // → 'Subskrybuj'
subscribeMobile: 'Subskrajb', // → 'Subskrybuj'
subscribed: 'subskrajbd',     // → 'Subskrybujesz'
subscribers: 'subskrajberów', // → 'subskrybentów'
```

**Plik:** `app/components/SubscribeButton.tsx`, linia ~203:
```tsx
{isSubscribed ? (t.subscribed || "subskrajbd") : (t.subscribe || "Subskrajb")}
```
Fallback hardkodowane — zaktualizować razem z LanguageContext.

---

### PROBLEM 3 — Hardkodowany email w polityce prywatności

**Plik:** `app/polityka-prywatnosci/page.tsx`, linia 53:
```tsx
pawel.perfect@gmail.com
```
→ Zamienić na `{process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? ''}`.

Wzorzec już stosowany poprawnie w `app/components/PremiumWrapper.tsx:391`.
`app/components/Footer.tsx` — zweryfikować czy też używa env var (nie hardkodu).

---

### PROBLEM 4 — Brak canonical URL

**Plik:** `app/watch/[slug]/page.tsx` — `generateMetadata` nie zawiera `alternates.canonical`
**Plik:** `app/channel/[slug]/page.tsx` — `generateMetadata` nie zawiera `alternates.canonical`

**Fix:**
```ts
alternates: {
  canonical: `${process.env.NEXT_PUBLIC_APP_URL}/watch/${params.slug}`,
},
```
(analogicznie `/channel/${params.slug}` dla drugiego pliku)

`NEXT_PUBLIC_APP_URL` jest już używane w innych miejscach projektu.

---

### PROBLEM 5 — Martwy kod (nieużywane komponenty)

```
app/components/VideoStory.tsx  — zero importów w całym projekcie
app/components/VideoTabs.tsx   — zero importów w całym projekcie
```

Zweryfikowane przez:
```bash
grep -rn "VideoStory\|VideoTabs" app/ lib/ --include="*.tsx" --include="*.ts"
# → brak wyników poza samymi plikami
```

**Fix:** Usunąć oba pliki.

---

### PROBLEM 6 — Hardcoded 500 w route komentarzy (jeden pozostały)

**Plik:** `app/api/admin/comments/reports/[reportId]/resolve/route.ts:25`
```ts
return NextResponse.json({ error: result.error.message }, { status: 500 });
```
→ Zamienić na `return fromUseCaseResult(result);`

Pozostałe route'y komentarzy (hide, restore, delete, heart) — **już naprawione**, używają poprawnego wzorca.

---

## 4. Co roadmapa opisuje jako problem — a w kodzie jest OK

| Pozycja z roadmapy | Stan faktyczny |
|---|---|
| S-001/S-002 — brak auth w admin routes | ✅ Naprawione |
| BUG-001 — Redis wywala 500 | ✅ Naprawione — jest try/catch |
| BUG-003 — hardcoded 500 w komentarzach | ✅ Prawie — jeden plik pozostał (patrz Problem 6) |
| BUG-007 — brak try/catch przy req.json() | ✅ Naprawione |
| INCOMPLETE-001 — HELD_FOR_REVIEW bez implementacji | ✅ Zaimplementowane — `hold-comment-for-review.use-case.ts`, `approve-held-comment.use-case.ts`, UI w admin |
| INCOMPLETE-003 — brak admin UI dla sporów | ✅ Zaimplementowane — `dispute-sync` endpoint i UI |
| INCOMPLETE-004 — bounce/complaint bez supresji | ❌ Nadal problem (patrz Problem 1) |
| INCOMPLETE-005 — brak admin refund endpoint | ✅ Zaimplementowane — `app/api/admin/payments/[id]/refund/` |
| INCOMPLETE-007 — Actor.isPatron martwe pole | ✅ Usunięte z `actor.ts` |
| SEO — sitemap z /?v=id | ✅ Naprawione — sitemap generuje `/watch/{slug}` |
| CLEANUP-003 — typo Subskrajb | ❌ Nadal w kodzie (patrz Problem 2) |
| CLEANUP-004 — hardkodowany email | ❌ Częściowo — polityka prywatności nadal hardkoduje |
| VideoStory/VideoTabs martwe | ❌ Nadal w kodzie (patrz Problem 5) |

---

## 5. Dług techniczny — duże tematy (niezweryfikowane szczegółowo)

### Legacy services (28 plików w lib/services/)

Roadmapa ma dokładną mapę. Mapa jest aktualna — `lib/services/` nadal istnieje równolegle z `lib/modules/`.
Priorytet według roadmapy:

| Akcja | Pliki |
|---|---|
| USUŃ (martwe) | `user.service.ts`, `content.service.ts`, `subscription.service.ts`, `payments-admin.service.ts` |
| PRZENIEŚ (DTO) | `comment.dto.ts`, `playback.dto.ts`, `videos-admin.dto.ts`, `payments-admin.dto.ts` |
| ZREFAKTORYZUJ | `email.service.ts`, `user-access.service.ts`, `profile.service.ts` |

To jest największe ryzyko regresji — robić etapami z pełnym CI po każdym kroku.

### Nieużywane paczki npm

Nie zweryfikowano szczegółowo w tym audycie, ale roadmapa wymienia:
`artplayer`, `tw-animate-css`, `@react-email/render`, `@base-ui/react`, `sharp`

Przed usunięciem każdej paczki — zweryfikować grep w kodzie.

### Error handling w route'ach

Poza jednym pozostałym hardcoded 500 (Problem 6), reszta wymaga przeglądu spójności.
Docelowy wzorzec:
```ts
const { adminUserId, response } = await requireAdminForApi("OPERACJA");
if (response) return response;
try {
  const result = await useCase(input, ctx);
  return fromUseCaseResult(result);
} catch (error) {
  return handleApiError(error);
}
```

---

## 6. Szacunkowy status gotowości (na podstawie kodu, nie dokumentacji)

```
Domenowa logika biznesowa (patron/płatności/dostęp):  █████████░  ~90%
Bezpieczeństwo API:                                    █████████░  ~90%
Admin panel:                                           ████████░░  ~75%
Frontend publiczny:                                    ████████░░  ~75%
Architektura / czystość kodu:                          █████░░░░░  ~55%
```

---

## 7. Sugerowany plan PR-ów

### PR A — natychmiastowe (wszystkie to zmiany 1-5 linii w znanych plikach)
1. Problem 1 — bounce/complained → handleUnsubscribe
2. Problem 2 — typo Subskrajb
3. Problem 3 — email w polityce prywatności
4. Problem 4 — canonical URL w watch i channel
5. Problem 5 — usunięcie VideoStory.tsx i VideoTabs.tsx
6. Problem 6 — hardcoded 500 w resolve route

### PR B — legacy services (ryzyko regresji, robić etapami)
Migracja `lib/services/` według mapy z roadmapy. Zacząć od martwych plików (USUŃ).

### PR C — nieużywane paczki npm
Po weryfikacji grep dla każdej paczki.

### PR D — admin panel UX
Bulk actions w komentarzach, spójne loading states, nawigacja do osieroconych stron.

---

*Audyt: 2026-06-30. Weryfikacja przez bezpośrednie czytanie plików źródłowych na branchu main po zmerżowaniu PR #1272.*


---

## 8. Post-audit update — 2026-06-30 dependency/control-plane cleanup

Ten historyczny audyt pozostaje zapisem stanu z chwili wykonania. Późniejszy recheck kodu potwierdził, że szybkie punkty PR-A zostały domknięte w runtime: bounce/complaint suppression, copy typo, support email, canonical URLs, usunięcie `VideoStory`/`VideoTabs` oraz typed result w route komentarzy.

Dodatkowo usunięto dwie faktycznie nieużywane zależności: `artplayer` i `tw-animate-css`. `@base-ui/react`, `@react-email/render` oraz `sharp` zostają, bo aktualny kod/build ma dla nich uzasadnienie.

Pozostały dług: `lib/services/**` nadal jest aktywnie używany przez runtime/testy i wymaga dalszej migracji małymi, bezpiecznymi slice’ami. To nie jest blocker dla zamkniętych szybkich poprawek, ale nie wolno dokumentować go jako fizycznie usuniętego.
