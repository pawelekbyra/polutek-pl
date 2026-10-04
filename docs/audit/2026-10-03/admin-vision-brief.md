# Brief: nowy panel administratora pawelperfect.com (wizja, bez budowy)

Właściciel pisze po polsku, odpowiadaj po polsku. Cel całego przedsięwzięcia: zaprojektować **najlepszy możliwy panel dla jednego administratora (właściciela)**, a potem go zbudować. Na tym etapie powstaje WIZJA i projekt, nie kod produkcyjny.

## Czym jest serwis
Jednokanałowa platforma wideo jednego twórcy (https://www.pawelperfect.com): Next.js 16, React 19, Prisma, Postgres 17, Better Auth, Stripe (wyłącznie dobrowolne napiwki), własny HLS (oryginały i rendycje w R2, kodowanie w kontenerze `encoder`, dostarczanie przez Worker Cloudflare), Resend (e-maile), PP Support (osobny, własny system skrzynki obsługi), wszystko na jednym serwerze Hetzner CPX22 (2 vCPU, 4 GB RAM) w Docker Compose za Cloudflare Tunnel. Zasada: własny stos, zewnętrznie tylko Stripe, Cloudflare i Resend. Serwer jest mały: nowe rozwiązania muszą być lekkie albo dać się przenieść na drugi serwer. Przed startem publicznym; przy starcie serwer będzie powiększony.

## Obecny stan panelu (dlaczego chcemy go zrobić od nowa)
- Admin loguje się jak zwykły użytkownik i ma przełączkę na panel. Wynika to z początkowego założenia, że każdy użytkownik mógłby prowadzić swój kanał. To porzucone: jest jeden autor.
- Panel (`app/admin/**`, ok. 55 tras `app/api/admin/**`) nigdy nie był poważnie audytowany: nieestetyczny, szkielety ładowania, niespójna organizacja i logika, nie wszystko musi działać. Nie ma jednej powłoki (każda strona ma własny pasek).
- Decyzja właściciela (2026-10-04): panel ma być **niezależną aplikacją na własnej subdomenie `admin.pawelperfect.com`**, bez paska strony, regulaminu i bez związku z wyglądem serwisu publicznego. Dawniej (2026-09-30) osobny panel był odłożony jako przerost; stara analiza leży w historii gita: `git show 88c787d0:docs/audit/2026-09-30-admin-backoffice-architecture.md` (traktuj jako materiał, nie jako decyzję).

## Czego chce właściciel (jego słowa, zgrubnie)
1. Dedykowana subdomena, logowanie admina osobno, niezależny panel.
2. **Admin ma wiedzieć wszystko, co dzieje się na stronie**: bardzo dużo funkcji analitycznych, wszystkie parametry dostępne i wyświetlane (ruch na stronie, obciążenie serwera, statystyki...). Zaprojektować to od razu, żeby już na przyszłość nie trzeba było przebudowywać.
3. Każda zakładka i funkcja ma być **zaudytowana i zrobiona porządnie na nowo**, wizualnie zaprojektowana od początku, estetyczna nawigacja po zakładkach, doskonała organizacja.
4. Wizja oparta na wiedzy z internetu i o AI (jak to powinno wyglądać), plus **narzędzia, o których właściciel nie pomyślał**.
5. Ładowanie: **bez szkieletów** (tak jak na stronie publicznej: dane z serwera, od razu gotowe), płynnie, szybko.
6. Pełna swoboda i dostęp do wszystkiego; pewność, że panel nigdy nie jest „ślepy”.

## Zasady pracy każdego agenta
- Sprawdzaj aktualną wiedzę w internecie (WebSearch/WebFetch; jeśli odroczone, załaduj przez ToolSearch) i podawaj źródła (URL). Dziś jest 2026-10-04; zwracaj uwagę na aktualność (narzędzia, wersje, ceny).
- Praca tylko do odczytu na repozytorium i serwerze: nie zmieniaj kodu aplikacji, nie wdrażaj, nie dotykaj produkcji. Wolno `ssh serwerek '<polecenie tylko do odczytu>'` (np. `docker stats --no-stream`, `free`, `df`, `systemctl list-timers`, `ls`, `cat` plików konfiguracji bez sekretów), zwykłe GET do https://www.pawelperfect.com, oraz odczyt (GET) z API Cloudflare/Resend/Stripe tokenami z `%USERPROFILE%\.ai-secrets\secrets.env` (w Git Bash: `set -a; . <(tr -d '\r' < "$USERPROFILE/.ai-secrets/secrets.env"); set +a`; NIGDY nie wypisuj wartości sekretów). Żadnych zapisów w usługach zewnętrznych.
- Repo: pracuj w odizolowanym worktree; najpierw `git fetch origin && git switch --detach origin/main`. Dokumentacja projektu: `CLAUDE.md`, `docs/README.md`, `docs/operations/*.md`, `docs/architecture/*.md`, raporty z audytów w `docs/audit/2026-10-03/` (m.in. `audit-feat-admin.md` jeśli istnieje: poprzedni audyt panelu został przerwany limitem, więc może być niepełny albo go brakować).
- Dokument roboczy zapisz w podanym pliku w katalogu scratchpad:
  `C:\Users\ADMINI~1\AppData\Local\Temp\claude\C--Users-Administrator-Desktop-polutek-pl--claude-worktrees-dns-migration-cloudflare-bcfaf0\9c7527ae-390e-4303-bbcd-30976cc7b44f\scratchpad\`
- Konkret zamiast ogólników: nazwy, przykłady z realnych produktów, liczby, ścieżki plików, rzeczy do zrobienia. Wiadomość końcowa: maks. 350 słów po polsku, z 10 najważniejszymi wnioskami.
