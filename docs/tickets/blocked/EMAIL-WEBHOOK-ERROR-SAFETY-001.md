# EMAIL-WEBHOOK-ERROR-SAFETY-001 — Prevent webhook error, secret and PII disclosure

Status: CONFIRMED_GAP
Ticket ID: EMAIL-WEBHOOK-ERROR-SAFETY-001
Launch impact: HIGH

## Purpose
- Zapobiec wyciekowi wewnętrznych błędów, sekretów i PII w odpowiedziach publicznych.
- Sanitizacja logów i rekordów `EmailEvent`.

## Verified Current Behavior
- Route zwraca `result.error.message` bezpośrednio do klienta.
- `releaseWithFailure` zapisuje surowy tekst wyjątku do bazy.
- `acquireLock` znajduje się poza główną barierą błędów use case'u.

## Target Behavior
- Public response używa generycznej wiadomości (np. "Internal Server Error").
- Public response używa stabilnych kodów błędów (np. `WEBHOOK_PROCESSING_FAILED`).
- Surowe błędy DB/Providera trafiają tylko do sanitizowanych logów.
- `EmailEvent.error` nie przechowuje SQL, tokenów, URLi ani PII.

## Acceptance Criteria
- [ ] Implementacja `handleApiError` lub podobnego mechanizmu mapowania dla route'u webhooka.
- [ ] Testy z syntetycznymi sekretami w błędach dowodzące ich redakcji.
- [ ] `acquireLock` przeniesiony do kontrolowanego `UseCaseResult` boundary.
