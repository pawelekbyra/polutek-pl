# Decyzja: własny HLS zamiast Mux / Cloudflare Stream (2026-10-02)

Status: pilot wdrożony po stronie Cloudflare, kod w PR, aktywacja po deployu (procedura: `docs/operations/HLS-SELF-HOSTED.md`).

## Decyzja

Wideo serwujemy sami: kodujemy FFmpeg-iem na serwerku, trzymamy w prywatnym buckecie R2 `polutek-hls`, dostarczamy przez Worker na `video.pawelperfect.com` (Cloudflare Free). Poprzedni dostawca (Cloudflare Stream/Mux) zostaje jako zapas per film i jako automatyczny fallback w odtwarzaczu.

## Dlaczego tak, a nie inaczej

| Wybór | Uzasadnienie | Odrzucone |
|---|---|---|
| fMP4/CMAF, H.264 High, 2 s IDR, 6 s segmenty | działa w hls.js i natywnym Safari, jedna drabinka dla wszystkich; zgodne z tabelą Apple | HEVC/AV1 (zależne od sprzętu), TS (starsze, bez DRM-u) |
| Audio w każdej rendycji | jedna ścieżka audio: o połowę mniej żądań niż osobne `EXT-X-MEDIA` | osobne audio (sensowne dopiero przy wielu językach) |
| Własny master | ffmpeg nie pisze `FRAME-RATE` i nie dolicza audio do `BANDWIDTH` | muxer ffmpeg bez poprawek |
| Worker + token HMAC w ścieżce | **działa na planie Free**; dla hls.js i Safari identycznie; cache bez tokenu | WAF `is_timed_hmac_valid_v0` + Transform Rules (wymaga planu **Pro**, 20-25 USD/mies., rekomendacja z `02`, ale nie wolno nam wydawać pieniędzy bez właściciela) |
| R2 przez binding Workera (nie S3, nie r2.dev) | bucket w ogóle nieosiągalny z zewnątrz poza Workerem | publiczny bucket + niezgadywalne ścieżki (słabsza ochrona) |
| Fallback w odtwarzaczu | limit/awaria Workera nie zatrzymuje filmu; rollback bez deployu | brak zapasu |

## Ochrona: uczciwie

- Token (HMAC-SHA256, TTL 6 h) wydawany wyłącznie po `checkVideoAccess()` i bramce premiery (CLAUDE.md §4.3/§4.15); odmowa nie niesie żadnego URL ani sekretu. Worker odrzuca brak/zły/wygasły token (403) przed jakimkolwiek dostępem do cache lub R2. Ścieżki i rozszerzenia są ścisłą białą listą.
- Zalogowany widz **może skopiować URL i pobrać pliki** przez czas życia tokenu. To kontrola dostępu, nie DRM (Widevine/FairPlay wymagają packagera i licencji; poza zakresem). Przy filmach LOGGED_IN/PATRON, które i tak są darmowe po zalogowaniu (§4.4), akceptowalne.
- Wyciek `HLS_TOKEN_SECRET` pozwala podpisywać tokeny: trzymany tylko w sekretach Workera, `app.env` (600) i `.ai-secrets`. Rotacja: nowy sekret w Workerze i aplikacji.
- Brak limitu per IP/liczby tokenów (token jest bezosobowy; plan odtwarzania i tak podlega limitom aplikacji). Do ewentualnego dodania: Rate Limiting Rule (płatne).

## Koszt (szacunek, USD/mies.)

Założenia: film 3 min = ok. 55 MB w R2 (4 rendycje), ok. 35 żądań Workera na odtworzenie (master, playlista, init, 30 segmentów), widz ogląda ok. 3 filmy w miesiącu. Dane wejściowe: limity Cloudflare z `02` (Worker Free 100 tys. żądań/dobę; Paid 5 USD + 10 mln w cenie, potem 0,30 USD/mln; R2 10 GB i 10 mln odczytów klasy B gratis, egress 0 USD). Liczby cennika z dokumentacji, nie weryfikowane na fakturze.

| Aktywni widzowie/mies. | odtworzeń | żądań Workera/mies. | żądań/dobę (średnio) | Koszt |
|---|---|---|---|---|
| 100 | 300 | 10 tys. | 350 | 0 USD (Free) |
| 1 000 | 3 000 | 105 tys. | 3,5 tys. | 0 USD (Free) |
| 10 000 | 30 000 | 1,05 mln | 35 tys. | 0 USD, ale szczyty (premiera) mogą przekroczyć 100 tys./dobę; wtedy Workers Paid 5 USD/mies. (10 mln w cenie) |
| 100 000 | 300 000 | 10,5 mln | 350 tys. | ok. 5-6 USD (Paid) |

R2: kilkadziesiąt filmów to ok. 1-3 GB (w darmowych 10 GB). Odczyty klasy B tylko przy braku w cache (rząd procenta żądań). Transfer 0 USD (R2 i Cloudflare). Pozostałe ryzyko to regulamin Cloudflare przy bardzo dużym ruchu wideo na Free (wideo z R2/Workera jest dozwolone, ale `02` §10 zostawia ryzyko kontaktu ze strony Cloudflare).

## Pomiary pilota

Chrome (headless) + hls.js 1.6, ta sama maszyna i łącze (Warszawa, Cloudflare WAW), film 10 s, 3 powtórzenia: czas do pierwszej klatki **własny HLS 354-385 ms (ciepły cache), Cloudflare Stream 279-405 ms**; zimny start własnego 1125 ms (pierwsze żądanie, miss + R2) vs 1274 ms; 0 błędów, 0 przerw (poza początkowym `waiting`), hls.js startuje na 360p (okno 640 px, `capLevelToPlayerSize`). `curl` (6 prób, średnia): master 385 ms vs 403 ms (Stream), segment 540p 0,8 MB 1,0 s całkowicie, TTFB 386 ms; trafienie w cache Workera i `CF-Cache-Status: HIT` w WAW. Kodowanie: 13,5 s na 10 s materiału (3 rendycje, preset slow, serwerek). Rozdzielczość na zwykłym łączu domowym jest ograniczona opóźnieniem sieci (RTT ok. 90-120 ms), nie dostawcą. Test nie obejmuje Safari/iOS ani słabych łączy.

## Otwarte pytania do właściciela

1. **Pieniądze:** (a) Workers Paid 5 USD/mies. dopiero gdy ruch przekroczy 100 tys. żądań/dobę (premiera/viral); (b) Cloudflare Pro 20-25 USD/mies. tylko jeśli chcemy token WAF bez Workera albo rate limiting.
2. **Migracja pozostałych filmów:** potrzebne oryginały. Dziś oryginał trzyma tylko Cloudflare Stream/Mux (pilot kodowany z jego `default.mp4`, czyli już skompresowanego). Zasada na przyszłość: każdy upload najpierw do R2 `polutek`, potem kodowanie.
3. **Automatyzacja:** dziś ręcznie (kodowanie, upload, SQL). Czy robić kolejkę (pg-boss) i przycisk w adminie, kiedy i na której maszynie (CPU serwerka jest wąskim gardłem, SERWEREK.md §14)?
4. **Ochrona:** czy wystarczy "token, nie DRM"? Dla treści płatnych/ekskluzywnych potrzebny packager z DRM i licencje (koszt, nie robić bez decyzji).
5. **Napisy i wiele ścieżek audio:** nie obsłużone w HLS (napisy dziś z `subtitleUrlPl/En` poza HLS); trick play (I-frame) i podgląd na pasku (sprite) niezrobione.
6. **Skalowanie:** limity Free Workera są dobowe i twarde; fallback na poprzedniego dostawcę działa tylko dopóki on istnieje (usunięcie Mux/Stream = brak zapasu).
7. **Webhook Mux / Cloudflare Stream dla filmów z własnym HLS:** nadal wskażą stary asset; zostaje jako zapas.
