# Stan projektu

Status: **aktywny produkt po dużej stabilizacji**

Ten dokument opisuje bieżący stan Polutek.pl po zamknięciu głównego etapu refaktoryzacji i porządkowania fundamentów.

## Podsumowanie

Polutek.pl jest aplikacją właścicielską dla twórcy: platformą wideo, kanałem, systemem dostępu dla wspierających, panelem administracyjnym, komentarzami i integracjami płatności/email/wideo.

Duża faza refaktoru i stabilizacji została wykonana. Repozytorium nie powinno być dalej opisywane jako aktywny kryzys, emergency control-plane albo jeden wielki refaktor.

## Ustabilizowane obszary

- wideo, kanał i publikacja treści;
- playback i dostęp do materiałów;
- płatności, lokalna prawda płatności i idempotencja;
- komentarze, liczniki i moderacja;
- panel admina i zarządzanie treściami;
- DB-autorytatywne uprawnienia admina;
- diagnostyka kanału admina;
- CI, build, typecheck, testy, hotspoty i strict-escapes;
- dokumentacja historyczna i raporty pojednawcze.

## Obecny tryb engineeringu

Nie ma jednej aktywnej dużej kolejki refaktoryzacyjnej.

Dalsze prace powinny być małe i konkretne:

1. błąd albo usprawnienie;
2. krótki ticket/issue;
3. mały PR;
4. właściwe checki;
5. merge po sprawdzeniu.

## Co nie jest już dowodem niedokończonego refaktoru

Poniższe rzeczy są normalną pracą właścicielską lub operacyjną przy produkcie:

- treści i content inventory;
- checklisty smoke;
- konfiguracja dostawców;
- backup/restore i monitoring;
- regulamin, prywatność, cookies i support;
- decyzja o szerszej publikacji;
- drobne poprawki UX i tekstów.

Nie należy prowadzić dokumentacji tak, jakby te tematy oznaczały, że fundamenty aplikacji są nadal nierozwiązane.

## Jak czytać stare dokumenty

`docs/reports/reconciliation/`, stare tickety i wcześniejsze roadmapy są historią stabilizacji. Są przydatne jako dowód wykonanej pracy, ale nie są aktualną kolejką zadań.

Aktualny obraz projektu powinien zaczynać się od:

- `README.md`;
- `docs/PROJECT-STATE.md`;
- `docs/MASTERPLAN.md`;
- `docs/tickets/ready/README.md`.

## Kierunek

Polutek.pl ma wyglądać i działać jak gotowy, właścicielski produkt, który jest dalej rozwijany iteracyjnie. Dokumentacja ma wspierać ten obraz: jasno mówić, czym jest aplikacja, jak działa i jak ją utrzymywać, bez ciągłego eksponowania dawnego refaktoru jako aktywnego problemu.
