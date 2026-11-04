# Badanie funkcji dojrzałych serwisów wideo vs minimum dla platformy wielu twórców (HLS, subskrypcje, płatny dostęp)

Data: 2026-10-14. Metoda: WebSearch + WebFetch. Znaczniki: **[M]** must have na dzień otwarcia, **[S]** should w 6 mies., **[N]** nice. `[niepotw.]` = brak potwierdzenia w znalezionych źródłach (wiedza ogólna lub źródło wtórne/blogowe). Uczciwe zastrzeżenie: wiele oficjalnych stron pomocy YouTube zwróciło 404 lub nie zawierało szukanych danych, więc część liczb pochodzi ze źródeł wtórnych (oznaczone). Numery w nawiasach kwadratowych `(Sx)` odsyłają do listy źródeł na końcu.

## Wnioski nadrzędne

1. Rdzeniem "minimum" nie są funkcje YouTube'a, tylko pętla: wgraj -> przetworzone -> opublikuj (z widocznością) -> widz znajdzie/ogląda/wznawia -> twórca widzi liczby -> dostaje wypłatę. Reszta to nadbudowa.
2. Platformy z płatnym dostępem (Vimeo OTT, Patreon, Nebula, Substack) są prostsze od YouTube'a: mało metadanych, mocne płatności i prosty panel statystyk. To wzorzec dla małej platformy.
3. Najbardziej niedoszacowane w małych projektach: moderacja + zgłaszanie + odwołania (wymóg prawny w UE), eksport/usunięcie danych (RODO), oraz zasady wypłat (próg, podatki).
4. Liczby progowe konkurentów (YPP, Twitch, Rumble) są zmienne i często opisane tylko wtórnie; nie kopiować ich 1:1.

## A. Wgrywanie i zarządzanie filmem

| Funkcja | Stan u dojrzałych | Priorytet |
|---|---|---|
| Limity pliku | YouTube: 256 GB lub 12 h (mniejsze z nich), domyślnie 15 min dla niezweryfikowanych kont (S1). Vimeo: limity zależne od planu, plany od 17.06.2024 mają łączny storage zamiast tygodniowej kwoty; pojedyncze liczby (np. 20 GB Pro) tylko z pojedynczych źródeł (S4). Substack: 20 GB, MP4/H.264/AAC (S12, wtórne). Patreon: 100 h mediów/mies., 720p/1080p (S11). Dailymotion: 60 min / 2 GB [niepotw. - blog porównawczy] (S9). Rumble, Odysee: brak danych o limitach w źródłach. | [M] twarde limity rozmiaru/długości + kwota na twórcę (sterowanie kosztami storage/transkodowania) |
| Wznawialne wgrywanie | YouTube: wgrywanie wsadowe do 15 plików, dzienny limit uploadów per kanał, wspólny dla web/mobile/API (S2). Wznowienie (resumable) w dokumentacji nie potwierdzone. | [M] wznawialne (tus/multipart) - przy plikach GB brak wznawiania = utrata twórców [niepotw. jako cecha konkurentów] |
| Przetwarzanie | YouTube pokazuje szacowany czas dla SD/HD/4K; film można publikować po zakończeniu SD (S2). | [M] statusy: wgrano / przetwarzanie % / gotowe / błąd; publikacja po pierwszej jakości; [S] powiadomienie o końcu |
| Metadane | Tytuł max 100 znaków (S13). Limity opisu (5000) i tagów (500) nie potwierdzone w wynikach [niepotw.]. Pola YouTube: opis, tagi, kategoria, język, licencja, data nagrania, lokalizacja, napisy, karty końcowe (wiedza ogólna [niepotw.]). | [M] tytuł, opis, miniatura, język, widoczność, napisy (wgranie pliku .vtt); [S] kategoria, tagi, rozdziały, data nagrania; [N] lokalizacja, licencja, karty końcowe |
| Miniatura | Własna miniatura; CTR miniatur to metryka (S5). | [M] upload własnej + automatyczna klatka |
| Rozdziały | Raport retencji "key moments" wymaga >=60 s i >=100 wyświetleń (S3). Automatyczne rozdziały: opcja w edycji zbiorczej YouTube (S13). Vimeo: znaczniki rozdziałów zachowują się po podmianie pliku (marketing, S4). | [S] rozdziały ręczne w opisie (parsowanie `0:00`), [N] auto |
| Widoczność | YouTube: prywatny / niepubliczny / publiczny / zaplanowany; Premiere. Vimeo: prywatność per film i zbiorczo na folderze (S4). | [M] prywatny, niepubliczny (link), publiczny, "tylko dla płacących"; [S] zaplanowany; [N] premiera |
| Ograniczenie wieku / dla dzieci | YouTube: ustawienie "Made for kids" ma konsekwencje (wyłączone komentarze i personalizacja [niepotw. w pobranych stronach]); w memberships kanał "dla dzieci" jest wykluczony (S8). | [M] flaga 18+ (potrzebna prawnie przy treściach dla dorosłych, Patreon Video wyłącza 18+ - S11); [S] pełne "dla dzieci" tylko jeśli platforma celuje w dzieci |
| Wykrywanie praw autorskich | YouTube Content ID: skan każdego uploadu, właściciel wybiera blokuj/monetyzuj/śledź, per kraj; dostęp tylko dla dużych właścicieli (S14). | [N] automat (kosztowny); [M] za to ręczny proces zgłoszeń (sekcja G) |
| Ustawienia domyślne i edycja zbiorcza | YouTube: "Upload defaults" (widoczność, kategoria, licencja, opis, tagi) i edycja zbiorcza (tytuł, opis, tagi, język, widoczność, monetyzacja, komentarze, rozdziały) (S13; wtórne). | [S] edycja zbiorcza widoczności/playlist; [N] domyślne |
| Playlisty, import | Playlisty = standard; import z innych platform [niepotw.]. Rumble ogranicza usuwanie filmów zależnie od licencji (S10). | [S] playlisty; [N] import z URL |
| Podmiana pliku | Vimeo "Replace video": zachowuje ID, URL, embed, miniaturę, napisy, statystyki (S4, tekst marketingowy - zweryfikować). YouTube: brak podmiany pliku, tylko przycinanie/edytor [niepotw.]. | [S] podmiana pliku z zachowaniem ID; [N] przycinanie |

## B. Subskrypcje i powiadomienia

| Funkcja | Stan | Priorytet |
|---|---|---|
| Subskrypcja kanału | Podstawa wszędzie; liczbę subskrybentów twórca może ukryć publicznie, w Studio nadal widzi (S8, wtórne). | [M] subskrypcja + ukrywanie licznika |
| Dzwonek | YouTube: wszystkie / spersonalizowane / brak (strona pomocy zwróciła 404 - [niepotw.] w źródłach, wiedza ogólna). | [S] 2 poziomy (wszystkie/brak) w [M], 3 poziomy w [S] |
| E-mail/push, digest | YouTube: digest e-mail; push mobilny [niepotw.]. | [M] e-mail o nowym filmie (z wypisaniem); [S] digest dzienny/tygodniowy; [N] push web |
| Strona "Subskrypcje" | Feed od subskrybowanych kanałów - u wszystkich dojrzałych [niepotw. w źródłach]. | [M] |
| Członkostwa/poziomy | YouTube: do 6 poziomów, 20 stałych cen ($0,99-$499,99 w USA), zmiana ceny raz na 12 mies., 70% przychodu po podatkach, zwroty obciążają kanał (S8, wtórne). Vimeo OTT: SVOD + TVOD (S6). | [M] min. 1 poziom płatny + darmowy; [S] wiele poziomów z perkami |
| RSS | YouTube: `feeds/videos.xml?channel_id=` (15 ostatnich, bez prywatnych/niepublicznych; raportowane sporadyczne 404 od XII 2025) (S15). | [S] RSS kanału (publiczne); prywatny RSS dla płacących jako [N] (wymaga tokenu) |
| Eksport listy subskrybentów | Dla twórcy - nie potwierdzono w źródłach [niepotw.]. Dla widza: Takeout daje subscriptions.csv (S16). | [S] eksport CSV subskrybentów (zgodnie z RODO, tylko to co zgoda obejmuje) |

## C. Dane i analityka twórcy

| Funkcja | Stan | Priorytet |
|---|---|---|
| Podstawowe metryki | YouTube Studio: zakładki Reach (wyświetlenia, wyświetlenia miniatur, CTR miniatur, unikalni widzowie), Engagement, Audience (nowi/powracający, subskrybenci), Revenue (S5, S3, S17). Definicja CTR: miniatura widoczna >1 s i >=50% powierzchni (S5, wtórne). | [M] wyświetlenia, czas oglądania, średni % obejrzenia, subskrybenci +/-, dochód; [S] źródła ruchu, kraje, urządzenia, nowi/powracający; [N] CTR miniatur |
| Retencja | YouTube: wykres retencji tylko per film; dane przetwarzane 1-2 dni; wykrywa momenty, wymaga >=60 s i >=100 wyświetleń; segmenty: nowi/powracający, subskrybenci/nie (S3). Vimeo: retencja i engagement tylko w płatnych planach, eksport CSV tabeli (S18). | [S] wykres retencji (agregaty co N sekund wystarczą) |
| Aktualność | Dane finalne zwykle po 2-3 dniach (źródło wtórne, S5); YouTube ma też "Realtime" [niepotw. szczegóły]. | [M] jawna etykieta "dane z dnia X"; [N] realtime |
| Eksport/API | Vimeo: eksport CSV z filtrami, ale tylko dane najwyższego poziomu; engagement nie jest w publicznym API (S18). YouTube Analytics API: `reports.query` wymaga kanału, dat i >=1 metryki, wymiary i filtry opcjonalne, scope `youtube.readonly` (S19). | [S] eksport CSV; [N] API analityczne |
| Dochód | RPM vs CPM: RPM po udziale platformy, zawiera memberships/Super Chat; wiele pojęć "estimated revenue" (S20). | [M] dochód per film i per okres, rozbity na źródła; jasna definicja "przed/po opłatach" |
| Widz | Historia oglądania i subskrypcje w Takeout (S16). "Obejrzyj później", "kontynuuj oglądanie", publiczne liczniki - standard [niepotw. w źródłach]. | [M] kontynuuj oglądanie (zapis pozycji), publiczny licznik wyświetleń; [S] historia + "obejrzyj później"; [N] ukrywanie historii |

## D. Społeczność

| Funkcja | Stan | Priorytet |
|---|---|---|
| Komentarze | YouTube: komentarze, odpowiedzi, przypięcie, serduszko, sortowanie [niepotw. - pobrane wyniki nie potwierdziły sortowania/przypinania/serduszek] (S21). | [M] komentarze z odpowiedziami (1 poziom), usuwanie przez twórcę; [S] przypinanie, serduszko, sortowanie top/nowe |
| Moderacja | YouTube: poziomy None/Basic/Strict/Hold all per film; zablokowane słowa wstrzymują komentarze do 60 dni; linki można wstrzymywać; zatwierdzeni użytkownicy zwolnieni; ukrywanie użytkownika; moderatorzy bez dostępu do Studio (S21). | [M] ręczne zatwierdzanie (hold all), blokada użytkownika, lista słów; [S] zatwierdzeni użytkownicy, moderator jako rola |
| Posty społeczności, ankiety | YouTube i Patreon (posty); Substack (Notes) [niepotw. szczegóły]. Substack Notes: wideo max 5 min (S12). | [S] posty tekstowe dla subskrybentów; [N] ankiety |
| Czat na żywo | Twitch, YouTube, Odysee ("hyperchats") (S22). Poza zakresem VOD. | [N] |
| Polubienia, udostępnianie | Polubienia/niepolubienia; link z czasem (`?t=`), embed - standard [niepotw. w źródłach]. | [M] link z czasem + embed; [S] polubienia |

## E. Odkrywanie

| Funkcja | Stan | Priorytet |
|---|---|---|
| Strona główna/wyszukiwanie | Standard; filtry i sortowanie [niepotw. szczegóły]. Odysee: trending, top, newest (S22). | [M] wyszukiwanie po tytule/opisie/kanale, lista najnowszych; [S] filtry, kategorie; [N] rekomendacje |
| Strona kanału | Zakładki: filmy, playlisty, o kanale, społeczność [niepotw.]. | [M] filmy, o kanale; [S] playlisty, społeczność |
| SEO | Google: VideoObject wymaga name, thumbnailUrl, uploadDate (źródła wtórne różnią się co do description); zalecane contentUrl, duration, embedUrl; film musi być osadzony na indeksowalnej stronie z miniaturą pod stabilnym URL; sitemap wideo lub mRSS (S23). | [M] strona oglądania z OG + JSON-LD VideoObject + video sitemap (uwaga: płatne filmy - `isAccessibleForFree`/paywall markup [niepotw.]); [S] `noindex` dla prywatnych |
| Embed/oEmbed | YouTube oEmbed: `youtube.com/oembed?url=`, JSON z title, html, thumbnail_url (S15). | [S] oEmbed + iframe embed (z kontrolą domen dla płatnych); [N] |

## F. Konto i platforma

| Funkcja | Stan | Priorytet |
|---|---|---|
| Eksport danych/usunięcie | YouTube: wyłącznie przez Google Takeout (JSON/CSV; wygasa po 7 dniach, limit 5 pobrań wg wtórnego źródła) (S16). Usunięcie kanału nie potwierdzone w wynikach [niepotw.]. | [M] eksport danych i usunięcie konta (RODO art. 15/17/20); [S] self-service |
| Odtwarzacz | Napisy, prędkość, jakość, skróty, PiP, tryb kinowy, autoodtwarzanie, Chromecast - cechy YouTube, w źródłach nie potwierdzone osobno [niepotw.]. | [M] napisy, prędkość, jakość (ABR + ręczna), pełny ekran, skróty podstawowe, wznawianie; [S] PiP, tryb kinowy; [N] Chromecast, autoplay |
| Aplikacje | Mobilne/PWA - [niepotw.]. | [M] responsywny web; [S] PWA; [N] aplikacje natywne |
| Prywatność | Ukryty licznik subskrypcji, ukrywanie historii [niepotw. szczegóły]. | [M] zgoda/ustawienia cookies, widoczność profilu |

## G. Zaufanie i prawo

| Funkcja | Stan | Priorytet |
|---|---|---|
| Strajki | YouTube: ostrzeżenie, potem strajk; strajki wygasają po 90 dniach; 3 w 90 dniach = zamknięcie kanału (S24). | [S] proste ostrzeżenie/zawieszenie, [M] ręczna możliwość zdjęcia treści z powiadomieniem |
| Odwołania | YouTube: odwołanie w Studio, okno 90 dni (wersje strony różnią się: 90 dni vs 6 mies./1 rok); usunięcie filmu nie kasuje strajku i blokuje odwołanie (S24). | [M] formularz odwołania do każdej decyzji moderacyjnej (wymóg DSA, art. 20) |
| DSA | Art. 16: mechanizm zgłaszania treści; art. 17: uzasadnienie decyzji (statement of reasons); art. 20: wewnętrzny system skarg, rozpatrywany przez człowieka; art. 22: zaufani sygnaliści z priorytetem (S25, wtórne - zweryfikować w EUR-Lex). Zastosowanie do małej platformy: zakres obowiązków zależy od statusu mikro/małego przedsiębiorstwa [niepotw. - wymaga porady prawnej]. | [M] zgłoszenia + uzasadnienie + odwołanie |
| Prawa autorskie | DMCA / notice-and-takedown i counter-notice - procedura jest standardem, w pobranych stronach YouTube nie potwierdzona [niepotw.]. Rumble: licencje powiązane z możliwością usunięcia filmu (S10). | [M] formularz zgłoszenia naruszenia + procedura + kontakt agenta |
| Weryfikacja kanału | Plakietka - [niepotw.]. YouTube wymaga 2FA dla twórców w YPP (od 1.11.2021, wtórne, S26). | [S] plakietka; [M] 2FA minimum dla twórców pobierających wypłaty |
| Role w kanale | YouTube: Manager (bez usuwania kanału), Editor, Editor (limited), Subtitle editor, Viewer, Viewer (limited); osobna warstwa moderatorów komentarzy bez dostępu do Studio (S26, S21). | [S] role: właściciel/redaktor/moderator; [M] tylko właściciel + 2FA |

## H. Monetyzacja

| Mechanizm | Stan | Priorytet |
|---|---|---|
| Członkostwa | YouTube 70% dla twórcy po podatkach i opłatach (S8). Patreon: opłata platformy 5-12% zależnie od planu i daty startu, plus przetwarzanie 2,9%+$0,30 (wtórne) (S11). Substack 10% + Stripe (wtórne) (S12). | [M] min. jeden poziom płatny z dostępem do filmów |
| Płatny dostęp do filmu | Vimeo OTT: TVOD (kup/wypożycz) 10% + $0,50 per transakcja; SVOD $1/subskrybent/mies. + 2,5%+30c; PPV dla eventów na żywo; wypożyczenie bez pobierania, zakup z opcją pobierania; Vimeo wylicza podatek VAT/sales tax (S6). Patreon: zakupy jednorazowe (pending do 7 dni, S11). PWYW: nie potwierdzono [niepotw.]. | [M] jednorazowy zakup filmu lub subskrypcja; [S] wypożyczenie czasowe, PPV; [N] PWYW |
| Napiwki | YouTube Super Thanks/Chat, Twitch Bits ($0,01/bit), Odysee tipy w LBC (S7, S22) | [S] prosty napiwek przez dostawcę płatności |
| Współdzielenie przychodu | Nebula: po pokryciu kosztów 50% do operatora, 50% do twórców proporcjonalnie do czasu oglądania; twórcy mają udziały (2019, S27). Rumble: licencje wideo + reklamy; progi i udział rozbieżne wg źródeł wtórnych (S10). | [M] jawny podział (%), okres rozliczeniowy; [S] model "pula wg czasu oglądania" jako alternatywa |
| Wypłaty | YouTube: przez AdSense, próg ~$100 (zależnie od waluty), wypłata 21.-26. dnia miesiąca, wymagane dane podatkowe (S7, wtórne). Twitch: $50 (wire $100), wymaga statusu affiliate/partner (S28). Rumble: $50, do 60 dni opóźnienia (S10). Patreon: wypłata na żądanie 3-5 dni, blokada 5 dni po zmianie danych (S11). Vimeo VOD: 90% raz w miesiącu przez PayPal (starszy produkt) (S6). | [M] próg (np. 50-100), cykl miesięczny, dane podatkowe, KYC przez dostawcę (Stripe Connect itp.); [S] panel sald i faktur |
| Próg wejścia do monetyzacji | YouTube dwupoziomowo: 500 sub. (fan funding) / 1000 sub. + 4000 h (reklamy); zapowiadane podwojenie progów od II 2027 tylko w źródłach wtórnych (S7). Rumble: brak progów (S10). | [M] brak progu = niższa bariera; [S] weryfikacja tożsamości przed wypłatą |

## Rekomendacja minimalna na dzień otwarcia (checklist)

1. Upload wznawialny, limity, statusy przetwarzania, miniatura, napisy VTT.
2. Widoczność: prywatny / niepubliczny (link) / publiczny / tylko dla płacących; flaga 18+.
3. Subskrypcja kanału + powiadomienie e-mail + strona Subskrypcje.
4. Płatność: jednorazowy zakup + subskrypcja, wypłaty z progiem i danymi podatkowymi.
5. Statystyki: wyświetlenia, czas oglądania, średni %, przyrost subskrybentów, dochód z jawną datą aktualności.
6. Komentarze z moderacją (hold all, blokada, lista słów).
7. Strona oglądania: JSON-LD VideoObject, OG, sitemap; embed.
8. Wznawianie oglądania, napisy, prędkość, jakość.
9. Zgłaszanie treści, odwołania, uzasadnienie decyzji, procedura praw autorskich, eksport i usunięcie danych.
10. 2FA twórców (minimum dla wypłat).

## Ograniczenia badania

- Strony pomocy YouTube dot. widoczności, powiadomień i moderacji zwróciły 404 przy bezpośrednim pobraniu; informacje o nich pochodzą z wyszukiwań lub oznaczone `[niepotw.]`.
- Dla Dailymotion, Odysee, Rumble (limity) i Nebula (aktualne warunki) brak oficjalnych dokumentów w wynikach; dane wtórne i często z 2019-2022.
- Liczby finansowe (opłaty Patreon/Substack, progi YPP) zmieniają się; przed użyciem w modelu biznesowym zweryfikować na stronach oficjalnych.

## Źródła

- S1 https://support.google.com/youtube/answer/71673 (przez wyniki wyszukiwania), https://fast.io/resources/youtube-upload-limit.md
- S2 https://support.google.com/youtube/answer/57407
- S3 https://support.google.com/youtube/answer/9314415
- S4 https://help.vimeo.com/hc/en-us/articles/12426156259473-Video-settings-overview ; https://vimeo.com/product/replace-video-files ; https://help.vimeo.com/hc/en-us/articles/26238558836881-What-is-the-difference-between-upload-quota-video-usage-and-total-storage ; https://vimeo.com/blog/post/privacy-improvements
- S5 https://support.google.com/youtube/answer/9002587 ; https://green-fields.pl/en/?p=538
- S6 https://help.vimeo.com/hc/en-us/articles/12426980310417-Ways-to-sell-on-Vimeo-OTT ; https://help.vimeo.com/hc/en-us/articles/12425768622481 ; https://vimeo.com/product/sell-videos-online-with-pay-per-view
- S7 https://support.google.com/youtube/answer/13429240 ; https://air.io/en/monetization/youtube-partner-program-requirements-2026-the-complete-guide ; https://post-bridge.com/blog/when-does-youtube-start-paying-you
- S8 https://air.io/en/youtube-glossary/what-are-youtube-channel-memberships ; https://www.youtube.com/creators/earn/channel-memberships/
- S9 https://transcribe.com/blog/dailymotion-vs-youtube ; https://developers.dailymotion.com/guides/upload/
- S10 https://rumble.support/help/licensing-options ; https://rumble.support/help/delete-videos ; https://blog.eklipse.gg/beginner-guide-2/how-to-make-money-on-rumble.html
- S11 https://support.patreon.com/hc/en-us/articles/16733504643597-Pricing-FAQ ; https://support.patreon.com/hc/en-us/articles/203913499-Paying-out-your-earnings ; https://techcrunch.com/2022/11/03/patreon-adds-a-long-awaited-native-video-feature
- S12 https://www.kapwing.com/resources/substack-video-guide-monetization-how-to-post-and-aspect-ratios/ ; https://ppc.land/substack-introduces-mobile-video-publishing-with-monetization-features/
- S13 https://support.google.com/youtube/answer/57404 ; https://www.tella.com/definition/upload-defaults
- S14 https://support.google.com/youtube/answer/2797370
- S15 https://www.ghacks.net/?p=180033 ; https://www.smashingmagazine.com/2019/11/programmatically-discovering-sharing-code-oembed/
- S16 https://docs.invidious.io/export-youtube-subscriptions/ ; https://takeoutday.org/guides/how-to-export-youtube-data
- S17 https://support.google.com/youtube/answer/9314357
- S18 https://help.vimeo.com/hc/en-us/articles/44934439084561-About-engagement-analytics ; https://help.vimeo.com/hc/en-us/articles/21137121658897-About-viewer-retention-stats ; https://help.vimeo.com/hc/en-us/articles/12426192735633-Analytics-FAQ
- S19 https://developers.google.com/youtube/analytics/v1/reports/query
- S20 https://support.google.com/youtube/answer/9314357 (RPM/CPM)
- S21 https://support.google.com/youtube/answer/9483359 ; https://support.google.com/youtube/answer/15535966
- S22 https://reclaimthenet.org/odysee-hyperchats/ ; https://reclaimthenet.org/odysee-overview/ ; https://blog.twitch.tv/en/2022/07/12/coming-soon-a-lower-payout-minimum/
- S23 https://developers.google.com/search/docs/appearance/structured-data/video ; https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps ; https://developers.google.com/webmasters/videosearch/
- S24 https://support.google.com/youtube/answer/185111 ; https://support.google.com/transparencyreport/answer/9209072
- S25 https://prighter.com/resources/laws/dsa/articles/article-22 ; https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-22/ ; https://mondaq.com/ireland/security/1460634/trusted-flaggers-under-the-dsa-what-you-need-to-know
- S26 https://support.google.com/youtube/answer/9481328 ; https://9to5google.com/2021/08/24/youtube-2-step-verification-requirement/
- S27 https://www.tubefilter.com/2019/06/10/standard-nebula-youtube-streaming-service/ ; https://www.tubefilter.com/2022/05/05/nebula-youtube-streaming-service-creator-classes/
- S28 https://tubefilter.com/2022/07/13/twitch-creator-payout-threshold-minimum/ ; https://licensing.routenote.com/blog/twitch-payments-threshold-lowered/
