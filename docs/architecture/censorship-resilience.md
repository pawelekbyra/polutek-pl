# Odporność na cenzurę i zdjęcie treści: wielu operatorów, własny edge, P2P jako dodatek (notatka, NIEAKTYWNA)

Status: **pomysł zapisany "na kiedyś", nic z tego nie jest wdrażane ani planowane** (decyzja właściciela, 2026-10-15). Cel notatki: odpowiedzieć, czy kierunek jest sensowny, i zachować ustalenia z badania. Dokument nie zmienia żadnych zasad z CLAUDE.md §4.x. Płatności opisuje osobno `payments-resilience.md` i tu ich nie powtarzamy.

Założenie: domenę, serwer, a nawet Cloudflare można zmienić. Pytanie dotyczy tylko tego, jaką technologię wybrać, żeby film był dostępny dla wszystkich, ładował się szybko i trudno go było zdjąć.

## 1. Werdykt

Kierunek jest sensowny, jeśli rozumiemy go jako **"wielu operatorów i wiele ścieżek dostępu do zwykłego HLS"**, a nie jako "film w sieci IPFS". Szybkość daje cache blisko widza. Odporność daje to, że żaden pojedynczy podmiot (rejestrator, hoster, CDN, procesor płatności) nie jest niezbędny. Sieci zdecentralizowane (IPFS, Arweave) są dobre jako archiwum, a nie jako ścieżka odtwarzania. Historia platform "wolnościowych" pokazuje, że przegrywa się najczęściej na płatnościach, hostingu i koncie bankowym, a nie na formacie plików.

## 2. Co faktycznie może zdjąć treść (punkty podatności)

1. Domena i DNS (rejestrator, rejestr TLD, orzeczenie sądu).
2. Konto u hostera (wyłączenie serwera lub adresu IP po zgłoszeniu).
3. CDN / reverse proxy.
4. Płatności i konto bankowe (osobna notatka).
5. Wyszukiwarki, sklepy z aplikacjami, dostawcy poczty.
6. Usługi trzecie (certyfikaty, fonty, analityka).

## 3. Co ustaliło badanie (2026-10-15)

Źródła częściowo wtórne; tam, gdzie nie udało się potwierdzić, jest to zaznaczone.

### 3.1 Jak działały platformy "odporne"

- **Odysee/LBRY dostarcza wideo głównie z infrastruktury operatora.** Repozytorium reflector opisuje serwer przyjmujący bloby do magazynu obiektowego (S3/Wasabi) ze stanem w MySQL oraz warstwowe cache dyskowe łączone w łańcuch regionów, czyli w praktyce CDN. Blockchain trzyma indeks. https://git.pigg.es/LBRYFoundation/reflector.go/raw/branch/master/readme.md
- **Odysee i Arweave.** W 2024 Forward Research (twórcy Arweave) przejęło Odysee po upadku LBRY Inc. (SEC) i zapowiedziało przejście na Arweave. W 2025 Odysee wygaszało napiwki w LBC na rzecz płatności opartych na Arweave (do lipca 2025), więc migracja trwała; źródła pierwotne potwierdzające jej zakończenie nie znalezione, stan na 2026 nieznany. https://reclaimthenet.org/odysee-decentralized-payments-arweave-wander-wallet-lbc-phaseout https://www.businesswire.com/news/home/20240606839450/en
- **BitChute** reklamował P2P (WebTorrent), ale raport z 2019 nie znalazł transferu P2P, wszystkie wideo szły z ich serwerów. Stracił Stripe i PayPal (2018) oraz, według własnych słów, część hostingu, biuro i konto bankowe. https://reclaimthenet.org/tag/bitchute
- **Parler** (2021): AWS zawiesił usługę, a Apple i Google usunęły aplikację ze sklepów. Dla nas lekcja: sklepy z aplikacjami i hyperscaler to punkty jednego klucza.
- **Rumble** zbudował własny CDN i centra danych, w czym częściowo widzi niezależność od hyperscalerów; po przejęciu Northern Data (czerwiec 2026) ma kilka do kilkunastu lokalizacji. To skala rzędu setek milionów dolarów, nie wzorzec dla nas. Liczb kosztów bandwidth nie udało się potwierdzić w źródłach pierwotnych (sprawdzić w raportach SEC). https://finance.yahoo.com/technology/ai/articles/rumble-eyes-3b-ai-compute-040202696.html

### 3.2 Technologie przechowywania i dostarczania

- **IPFS ma realny problem z opóźnieniem przy wideo.** Badanie 28 tys. wideo: częste przestoje przez wysokie RTT, jedna jakość kodowania i słabe działanie standardowego ABR, bo segmenty pochodzą od wielu peerów. https://researchconnect.suny.edu/en/publications/is-ipfs-ready-for-decentralized-video-streaming/ . Raporty operatorów: wolne serwowanie przypiętej treści to często wina bramki/DNS (4 do 10 s). https://discuss.ipfs.tech/t/ipfs-content-serving-slow-with-pinned-content/14398 . Brak benchmarków 2025 do 2026.
- **Arweave** (jednorazowa opłata, trwałe): źródła podają od kilku do kilkudziesięciu USD za GB (ok. $25/GB w zestawieniu z kwietnia 2024, silnie zależne od kursu). Dla biblioteki wideo to nieopłacalne jako główne przechowywanie; ma sens tylko dla wybranych materiałów lub manifestów. Wydajność strumieniowania przez bramki ar.io nie została zmierzona w żadnym źródle; ar.io zaleca nie opierać się na jednej bramce, a bramka arweave.net miała niestabilność po przekazaniu w marcu 2026. https://permaweb-journal.ar.io/article/economics-storing-large-data-on-arweave.html , https://docs.ar.io/learn/gateways/architecture/
- **Tor (usługa onion).** Brak pomiarów HLS przez v3 onion. Z ogólnych danych: dodatkowe przeskoki, ograniczona przepustowość przekaźników i deprioryzacja ruchu masowego. Realistycznie 480p do 720p z dużym buforem, nie 1080p60. Eksperyment Tor-CDN pokazuje, że wieloklientowe strumieniowanie wymaga osobnych klientów Tor. https://projects.bentasker.co.uk/jira_projects/browse/MISC-12.html

### 3.3 P2P w odtwarzaczu

- **p2p-media-loader** (Apache-2.0, aktywny, ok. 850 commitów): biblioteka JS dla Hls.js i Shaka, działa z Vidstack (którego używamy). Segmenty najpierw z HTTP, potem wymiana między peerami przez WebRTC; sygnalizacja przez tracker zgodny z WebTorrent, STUN do ICE. Publiczne trackery obsługują ok. 1000 do 2000 widzów jednocześnie; powyżej własny tracker (wt-tracker, Aquatic). Przy braku peerów wraca do HTTP, więc mała widownia nie psuje odtwarzania. Ograniczenie: P2P dotyczy tylko jednej ścieżki medialnej, a Safari wymaga iOS 17.1+. https://github.com/Novage/p2p-media-loader
- **Skuteczność nieudowodniona niezależnie.** Deklarowane "do 80% oszczędności CDN" to dane producenta; w badaniu nie znaleziono niezależnych pomiarów. Wynik zależy od długości segmentu (ok. 5 s), konfiguracji i wielkości widowni. Przy dużej widowni jednego filmu zysk jest realny, przy małej zerowy. Trzeba by to zmierzyć na własnych danych.
- **Prywatność:** P2P ujawnia IP widza innym peerom (RODO, polityka prywatności, zgoda lub opcja wyłączenia).

### 3.4 PeerTube (wzorzec federacji i redundancji)

- Redundancja: serwer może powielać cudze filmy (strategie "most viewed" i "recently-added", cache z `min_lifetime`); przeglądarka losowo pobiera segmenty ze źródła i z kopii, co odciąża oryginał. Wymaga CORS "wszystkie źródła" i dobrego łącza kopii. Kontrola, kto może kopiować: `nobody`/`followings`/`anybody`. https://docs.joinpeertube.org/admin/following-instances
- Federacja (ActivityPub) i P2P odciążające to osobne mechanizmy. Dla nas ciekawe jako wzorzec "mirror tylko z zaufanych".

### 3.5 Multi-CDN w HLS (standard)

- **HLS Content Steering** (`EXT-X-CONTENT-STEERING`) to standardowy sposób przełączania między CDN: każdy CDN jest "pathway", odtwarzacz pobiera mały JSON z priorytetami (TTL, `PATHWAY-PRIORITY`) i sam przełącza źródło bez przeładowania strumienia. Wsparcie: **zweryfikowane w naszym kodzie: hls.js 1.7.3 (wersja z package.json) ma wbudowany `ContentSteeringController` i parser tagu `EXT-X-CONTENT-STEERING`**; inne źródła podają Shaka od 4.6, dash.js, AVPlayer. Wymaga serwera sterującego (bezstanowy, wysoko dostępny, sam jest zależnością). https://dev.to/masonwritescode/build-multi-cdn-failover-with-hls-content-steering-hlsjs-and-a-40-line-server-1l8i
- To rozwiązuje nasz problem "wielu originów" bez własnej logiki w odtwarzaczu. Nasz odtwarzacz przekazuje Vidstackowi własną instancję biblioteki hls.js (`provider.library` w `app/components/player/self-hls.ts`), więc steering działa po stronie hls.js bez zmian w Vidstack. Do zrobienia: `xhrSetup` (podpisywanie żądań) musi obsłużyć adresy innych originów, a manifest musi być generowany z tagiem i listą pathway'ów (tego nie sprawdzano w praktyce).

### 3.6 Koszty edge

- **Bunny** (zweryfikowane na bunny.net/pricing/cdn, 2026-10-15): Standard (119 PoP) $0,01/GB Europa i Ameryka Płn., $0,03 Azja i Oceania, $0,045 Ameryka Płd., $0,06 Bliski Wschód i Afryka; Volume (tylko 10 PoP, jedna stawka globalna) $0,005/GB do 500 TB, $0,004 do 1 PB, $0,002 do 2 PB. Minimum miesięczne $1 (wcześniejsza wzmianka o $50 z zestawień okazała się nieprawdziwa). Przy 50 TB/mies. w Europie i USA ok. $500 (Standard) lub $250 (Volume, ale tylko 10 PoP, więc gorsze pokrycie).
- **Własny edge** wygrywa dopiero przy stałym, przewidywalnym dużym wolumenie i gdy jest ktoś do utrzymania. Koszt to nie tylko VPS, ale transfer (limity portu, "unmetered" to nie "bez limitu"), miss cache (egress z origina) i godziny pracy. Rozsądny punkt wyjścia: **tani CDN jako jedna ścieżka + własny origin w dwóch miejscach**, a własny edge dopiero po pomiarach.

### 3.7 Hosting, prawo i domeny

- **Hetzner** (DSA art. 6(1)): po zgłoszeniu informuje klienta, żąda usunięcia i oświadczenia w terminie (ok. 24 h); przy braku odpowiedzi może zablokować IP; jest ścieżka odwołania. Anegdotycznie zdarzały się wyłączenia całego konta po niezauważonym mailu. Wniosek: **skrzynka abuse musi być monitorowana, a ścieżka odpowiedzi szybka**, bo to najczęstsza realna przyczyna "zdjęcia". https://www.hetzner.com/de/legal/digital-services-act/
- **DSA:** hosting nie odpowiada za nielegalną treść, jeśli po otrzymaniu zgłoszenia działa niezwłocznie; trzeba mieć mechanizm zgłoszeń (art. 16) i uzasadnienia usunięć (art. 17). Mikro i małe firmy są zwolnione z części obowiązków platform (art. 19 do 28), ale nie z art. 16 i 17. Pełne stosowanie od 17.02.2024. Zweryfikowano w tekście: art. 16 (mechanizm zgłoszeń, dotyczy dostawców hostingu; wystarczająco szczegółowe zgłoszenie = faktyczna wiedza wg art. 6), art. 17 (uzasadnienie ograniczeń, m.in. ograniczenie widoczności, wstrzymanie płatności, zawieszenie konta) oraz art. 19 (zwolnienie mikro i małych platform z sekcji obowiązków platform, z wyjątkiem art. 24 ust. 3; zwolnienie trwa 12 miesięcy po utracie statusu). Nasz moduł moderacji i odwołań (CLAUDE.md §4.27) jest zgodny z tym kierunkiem.
- **Domeny:** sądowe zawieszenia domen następują na poziomie rejestratora i rejestru, a ccTLD zależą od woli krajowego rejestru (czasem szybko, czasem wcale). Strony po zawieszeniu często przenoszą się na inną domenę, co potwierdza sens listy mirrorów. Rejestry gTLD mają kontrakty ICANN z procedurą nadużyć. Domena na nazwie firmy, z rzeczywistym kontaktem abuse, jest mniej narażona niż anonimowa.

## 4. Porównanie opcji

| Opcja | Odporność | Szybkość startu | Koszt | Rola u nas |
|---|---|---|---|---|
| Własny HLS na wielu originach + Content Steering | dobra | bardzo dobra | niski do średni | **rdzeń** |
| Tani CDN (Bunny itp.) jako jedna ścieżka | średnia | bardzo dobra | niski | opcjonalna ścieżka |
| Własny edge (nginx/Varnish + geo-DNS) | dobra | bardzo dobra | średni, rośnie z ops | po pomiarach |
| P2P w odtwarzaczu (p2p-media-loader) | pomocnicza | rośnie z widownią | niski | dodatek |
| IPFS (własne węzły i bramka) | duża dla archiwum | słaba | średni | archiwum |
| Arweave | bardzo duża (trwałe) | wolne, nieprzebadane | wysoki ($/GB) | wybrane materiały |
| PeerTube (federacja/redundancja) | średnia | średnia | niski | wzorzec |
| Usługa onion (Tor) | duża dla domeny | wolna | niski | awaryjny dostęp |

## 5. Architektura docelowa (gdyby kiedyś)

1. **HLS zostaje** (własny pipeline, wiele jakości, ABR).
2. **Multi-origin + Content Steering:** te same segmenty u 2 do 3 operatorów w różnych jurysdykcjach; manifest wskazuje pathway'e, mały serwer sterujący ustawia priorytety.
3. **Cache brzegowy:** początkowo jedna ścieżka przez tani CDN, własne edge'e dopiero po zmierzeniu ruchu i hit ratio. Segmenty niezmienne, więc cache jest skuteczny.
4. **Podpisane manifesty i adresowanie po hashu** (mirror nie musi być zaufany).
5. **P2P** w odtwarzaczu jako dodatek (z zgodą/opcją wyłączenia z powodów prywatności).
6. **Archiwum** w IPFS (własny pinning); Arweave tylko dla materiałów kluczowych.
7. **Domena:** kilka domen na różnych rejestratorach i TLD, lista mirrorów w PWA, wersja onion jako ostatnia deska ratunku. Dane rejestracyjne i konta rozdzielone.
8. **Kopie zapasowe** niezależne od hostera (inny dostawca, szyfrowane).
9. **Operacje:** monitorowana skrzynka abuse, procedura odpowiedzi w terminie, mirror wyłącznie treści, które przeszły naszą moderację.

## 6. Kolejność (od najtańszego)

1. Drugi origin i failover/Content Steering w odtwarzaczu (po sprawdzeniu Vidstack).
2. Druga i trzecia domena + lista mirrorów w PWA.
3. Monitoring skrzynki abuse i runbook odpowiedzi na zgłoszenia.
4. Tani CDN jako dodatkowa ścieżka.
5. Podpisane manifesty.
6. Własny edge w 2 do 3 regionach (po pomiarach).
7. P2P w odtwarzaczu (po pomiarze, czy widownia jednego filmu jest wystarczająco duża).
8. Archiwum IPFS i usługa onion.

## 7. Ograniczenia i uwagi

- Odporność na cenzurę nie zwalnia z prawa: procedury DMCA/DSA i zgłoszenia nadużyć trzeba obsługiwać. Szybka, udokumentowana reakcja chroni domenę i hosting skuteczniej niż technologia.
- Im bardziej rozproszone, tym trudniej o szybkość, koszty i klucze. Stąd model hybrydowy zamiast czystego P2P.
- Treści z dostępem płatnym i prywatne wymagają kontroli dostępu na każdym originie (podpisane tokeny, bez współdzielonego sekretu w miejscach o niższym zaufaniu).
- Nie szukamy tu sposobów na obejście orzeczeń sądowych ani na ukrywanie treści nielegalnych.

## 8. Otwarte pytania

- Czy nasza skala widowni uzasadnia P2P i własny edge (pomiar: bajty z peerów vs CDN)?
- Jak `xhrSetup` (podpisywanie żądań) ma działać dla wielu originów i jak generować manifest z pathway'ami.
- Aktualny stan Odysee/Arweave (źródła pierwotne).
- Jak podpisywać tokeny dostępu między originami.
- Limity transferu i polityka bandwidth u hosterów (np. Hetzner), do sprawdzenia w ich regulaminach.
- Polityka prywatności: zapis o P2P i ujawnianiu IP.
