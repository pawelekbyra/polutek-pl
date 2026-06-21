# Polutek.pl — Masterplan

Status: **STABILIZACJA ZAKOŃCZONA / AKTYWNY PRODUKT**

Ten dokument zastępuje dawny, kryzysowy sposób patrzenia na repozytorium. Duży etap porządkowania architektury, runtime, CI, płatności, playbacku, komentarzy, panelu admina i diagnostyki został wykonany. Od tego momentu projekt powinien być prowadzony jak normalny, żywy produkt.

Historyczne raporty refaktoryzacyjne zostają w repozytorium jako ślad prac i materiał dowodowy. Nie są już aktywną listą zadań.

## 1. Aktualny stan

Polutek.pl jest aplikacją właścicielską dla twórcy: platformą wideo, kanałem, systemem dostępu dla wspierających, panelem administracyjnym, komentarzami i integracjami płatności/email/wideo.

Główny refaktor można uznać za zamknięty po wejściu ticketu `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`. Dalsze prace powinny być prowadzone przez małe, konkretne tickety lub issue.

## 2. Co zostało ustabilizowane

- runtime wideo i kanału;
- dostęp do materiałów i playback;
- płatności, lokalna prawda płatności i idempotencja;
- komentarze i moderacja;
- panel admina i zarządzanie treściami;
- DB-autorytatywne uprawnienia admina;
- diagnostyka kanału admina;
- CI, testy, hotspoty i strict-escapes;
- dokumentacja historyczna i raporty pojednawcze.

## 3. Obecny tryb pracy

Nie ma jednej aktywnej, dużej kolejki refaktoryzacyjnej.

Nowe prace powinny działać tak:

1. błąd, usprawnienie albo potrzeba produktowa;
2. mały ticket/issue;
3. mały PR;
4. właściwe testy/checki;
5. merge po sprawdzeniu.

Nie należy otwierać dużych, przekrojowych refaktorów bez konkretnego powodu produktowego albo stabilnościowego.

## 4. Operacje, prawo i publikacja

Rzeczy takie jak treści, konfiguracja providerów, checklisty smoke, backup/restore, copy prawne, regulaminy, polityka prywatności i decyzja o szerszej publikacji są pracami właścicielskimi/operacyjnymi.

Nie należy opisywać ich jako dowodu, że aplikacja jest nadal w stanie niedokończonego refaktoru. To normalne elementy prowadzenia produktu.

## 5. Dokumenty wejściowe

- `README.md` — opis produktu, uruchomienie i podstawowa dokumentacja;
- `docs/PROJECT-STATE.md` — bieżący stan produktu/repozytorium;
- `docs/tickets/ready/README.md` — aktywna kolejka kodowa, jeśli istnieje;
- `docs/operations/` — checklisty operacyjne i publikacyjne;
- `docs/reports/reconciliation/` — historia dużej stabilizacji i raporty dowodowe;
- `docs/architecture/CORE-INVARIANTS.md` — kluczowe zasady architektoniczne.

## 6. Zasada na przyszłość

Polutek.pl ma być rozwijany iteracyjnie. Dokumentacja ma pomagać zrozumieć produkt i stan repozytorium, a nie sprawiać wrażenie, że aplikacja jest jednym wielkim, wiecznie otwartym refaktorem.
