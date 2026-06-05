# Polutek.pl — Kontrakty API (Beta)

Ten dokument opisuje kontrakty dla publicznych endpointów API w systemie Polutek.pl. Wszystkie endpointy wymagają uwierzytelnienia przez Clerk, chyba że zaznaczono inaczej.

---

## 1. Subskrypcje (`/api/subscriptions`)

Obsługuje zapisywanie się na newsletter i śledzenie kanału (zgoda marketingowa).

### `GET /api/subscriptions?creatorId=[id]`
Zwraca status subskrypcji dla zalogowanego użytkownika.
- **Auth**: Wymagane
- **Output (200)**:
  ```json
  {
    "isSubscribed": boolean,
    "subscribedAt": string | null,
    "creatorId": string,
    "creatorSlug": string,
    "purpose": "EMAIL_NOTIFICATIONS"
  }
  ```
- **Error (401)**: `{ "error": "UNAUTHORIZED", ... }`

### `POST /api/subscriptions`
Tworzy subskrypcję (follow).
- **Auth**: Wymagane
- **Input**: `{ "creatorId": string }`
- **Output (200)**:
  ```json
  {
    "isSubscribed": true,
    "subscribedAt": string,
    "creatorId": string,
    "creatorSlug": string,
    "purpose": "EMAIL_NOTIFICATIONS",
    "message": string
  }
  ```
- **Efekty**: Tworzy rekord w tabeli `Subscription`, inkrementuje `subscribersCount` w modelu `Creator`.

### `DELETE /api/subscriptions?creatorId=[id]`
Usuwa subskrypcję (unfollow).
- **Auth**: Wymagane
- **Output (200)**:
  ```json
  {
    "isSubscribed": false,
    "deleted": boolean,
    "creatorId": string,
    "creatorSlug": string,
    "purpose": "EMAIL_NOTIFICATIONS",
    "message": string
  }
  ```
- **Efekty**: Usuwa rekord z tabeli `Subscription`, dekrementuje `subscribersCount` w modelu `Creator`.

---

## 2. Język użytkownika (`/api/user/language`)

Synchronizuje preferencje językowe między DB a metadanymi Clerk.

### `PATCH /api/user/language`
Aktualizuje język użytkownika.
- **Auth**: Wymagane
- **Input**: `{ language: "pl" | "en" }`
- **Output (200)**: `{ success: true }`
- **Efekty**: Aktualizuje `User.language` w DB oraz `publicMetadata.language` w Clerk.

---

## 3. Źródło mediów (`/api/media-source/[videoId]`)

Zwraca bezpieczny URL do odtwarzania materiału wideo.

### `GET /api/media-source/[videoId]`
- **Auth**: Wymagane (dostęp zależy od `AccessPolicy`)
- **Output (200)**:
  ```json
  {
    "hasAccess": true,
    "kind": "direct" | "hls" | "dash" | "youtube" | "vimeo" | "unknown",
    "label": string,
    "playbackUrl": string,
    "embedUrl": string, // opcjonalnie
    "needsProxy": boolean
  }
  ```
- **Error (403)**: `{ "hasAccess": false, "reason": string, "requiredTier": string }`

---

## 4. Płatności (`/api/checkout/create-intent`)

Inicjuje proces płatności przez Stripe.

### `POST /api/checkout/create-intent`
Tworzy Stripe Payment Intent dla napiwku/dostępu Patron.
- **Auth**: Wymagane
- **Input**:
  ```json
  {
    "amountMinor": number, // w groszach/centach
    "currency": "PLN" | "EUR",
    "title": string,
    "creatorId": string,
    "requestId": string // UUID dla idempotencji
  }
  ```
- **Output (200)**: `{ "clientSecret": string, "paymentId": string }`
- **Efekty**: Rezerwuje rekord `Payment` w statusie `PENDING`.

---

## 5. Webhooki

### `POST /api/webhooks/clerk`
Synchronizacja użytkowników. Weryfikowany przez Svix.
### `POST /api/webhooks/stripe`
Finalizacja płatności i nadawanie statusu Patron. Weryfikowany przez Stripe Signature.
