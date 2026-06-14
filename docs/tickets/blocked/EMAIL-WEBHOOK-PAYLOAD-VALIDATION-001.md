# EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001 — Add event-specific payload validation and prevent silent success

Status: CONFIRMED_GAP
Ticket ID: EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001
Launch impact: HIGH

## Purpose
- Dodać walidację schematu dla specyficznych typów eventów.
- Zapobiec oznaczaniu jako `PROCESSED` eventów, które nie wywołały skutku biznesowego z powodu błędnego payloadu.

## Verified Current Behavior
- Brak `email_id` powoduje tylko warning, a event może zostać oznaczony jako `PROCESSED`.
- Minimalny ledger payload pobiera `input.created_at`, który może być undefined (powinno być `data.created_at` w Resend).

## Target Behavior
- Schemat Zod (lub odpowiednik) per supported event.
- Wymagane pola (np. `email_id`, `to`, `from`) sprawdzane przed procesowaniem.
- Unsupported events są bezpiecznie ignorowane (200 OK, `ignored: true`).
- Supported but malformed events zwracają błąd (retryable lub permanent).

## Acceptance Criteria
- [ ] Implementacja walidacji payloadu w use-case.
- [ ] Poprawienie ścieżki do `created_at`.
- [ ] Testy dla malformed `email.bounced`, `email.complained`.
