# Dokumentacja

Dokumenty opisują **stan obecny**. Jeden temat, jeden plik. Gdy zmienia się kod, dokument zmienia się
albo znika w tym samym PR. Historia jest w git.

## Zacznij tutaj

| Co | Gdzie |
|---|---|
| Zasady dla agentów AI, mapa repo, niezmienniki | [`../CLAUDE.md`](../CLAUDE.md) |
| Otwarte prace, decyzje do podjęcia, kolejność | [`operations/STATUS.md`](operations/STATUS.md) |

## Jak to jest zbudowane (`architecture/`)

| Temat | Plik |
|---|---|
| Logowanie i konta (Better Auth) | [`architecture/auth-better-auth.md`](architecture/auth-better-auth.md) |
| Własny HLS: decyzje i budowa | [`architecture/self-hosted-hls.md`](architecture/self-hosted-hls.md) |
| PP Support: architektura i projekt agenta AI | [`architecture/support-center.md`](architecture/support-center.md) |
| Własna wysyłka poczty (plan na później) | [`architecture/self-hosted-mail-plan.md`](architecture/self-hosted-mail-plan.md) |
| Nowy panel administratora `admin.pawelperfect.com`: wizja, decyzje, fazy, jak zbudowana faza 1 | [`architecture/admin-panel.md`](architecture/admin-panel.md) |
| Nowy panel administratora: wdrożenie, rejestracja (`admin-enroll`), reset, rollback, status hosta | [`operations/ADMIN-PANEL.md`](operations/ADMIN-PANEL.md) |
| Nowy panel administratora: parytet ze starym `/admin` (każda funkcja, przycisk i trasa → ekran → faza) | [`architecture/admin-parity.md`](architecture/admin-parity.md) |
| Nowy panel administratora: klikalny prototyp (dane przykładowe) i system projektowy | [`design/admin-panel/DESIGN-SYSTEM.md`](design/admin-panel/DESIGN-SYSTEM.md), prototyp: `design/admin-panel/prototype-standalone.html` |

## Jak to obsługiwać (`operations/`)

| Temat | Plik |
|---|---|
| Serwer: układ, deploy, rollback, kopie, crony | [`operations/SERWEREK.md`](operations/SERWEREK.md) |
| Dzienna odprawa „co słychać?” (raport tylko do odczytu, skill `odprawa`) | [`operations/DAILY-BRIEFING.md`](operations/DAILY-BRIEFING.md) |
| Wydajność: test obciążenia, ilu widzów wytrzymuje serwer | [`operations/LOAD-TEST.md`](operations/LOAD-TEST.md) |
| Wideo: upload, kodowanie, diagnostyka | [`operations/VIDEO-PIPELINE.md`](operations/VIDEO-PIPELINE.md) |
| Wideo: dostarczanie HLS, Worker, R2 | [`operations/HLS-SELF-HOSTED.md`](operations/HLS-SELF-HOSTED.md) |
| Poczta: domeny, DNS, Resend, routing | [`operations/EMAIL_SETUP.md`](operations/EMAIL_SETUP.md) |
| Poczta: dostarczalność | [`operations/EMAIL_DELIVERABILITY.md`](operations/EMAIL_DELIVERABILITY.md) |
| PP Support: runbook | [`operations/SUPPORT-CENTER.md`](operations/SUPPORT-CENTER.md) |
| PP Support: przewodnik dla właściciela i obsługi | [`operations/PP-SUPPORT-GUIDE.md`](operations/PP-SUPPORT-GUIDE.md) |
| Dostępy agentów do usług (bez sekretów) | [`operations/AGENT_ACCESS.md`](operations/AGENT_ACCESS.md) |
| Google Workspace (do czasu anulowania) | [`operations/GOOGLE_ACCESS.md`](operations/GOOGLE_ACCESS.md), [`operations/DNS_BACKUP_mail_2026-10-02.md`](operations/DNS_BACKUP_mail_2026-10-02.md) |
| Licencje oprogramowania obcego | [`operations/THIRD_PARTY_NOTICES.md`](operations/THIRD_PARTY_NOTICES.md) |

## Audyty (`audit/`)

[`audit/2026-10-03/`](audit/2026-10-03/) zawiera raporty z przeglądu całego projektu (bezpieczeństwo,
baza, testy, frontend, ładowanie, style, operacje, zgodność prawna oraz podsystemy: wideo, logowanie,
komentarze, płatności, e-maile, panel admina). To materiał roboczy: znalezisko naprawione albo
przeniesione do `operations/STATUS.md` znika z raportu, a pusty raport jest usuwany.
