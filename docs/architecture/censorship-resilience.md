# Odporność na cenzurę i zdjęcie treści: wielu operatorów, własny edge, P2P jako dodatek (notatka, NIEAKTYWNA)

Status: **pomysł zapisany "na kiedyś", nic z tego nie jest wdrażane ani planowane** (decyzja właściciela, 2026-10-15). Cel notatki: odpowiedzieć, czy kierunek jest sensowny, i zachować ustalenia z badania. Dokument nie zmienia żadnych zasad z CLAUDE.md §4.x. Płatności opisuje osobno `payments-resilience.md` i tu ich nie powtarzamy.

Założenie: domenę, serwer, a nawet Cloudflare można zmienić. Pytanie dotyczy tylko tego, jaką technologię wybrać, żeby film był dostępny dla wszystkich, ładował się szybko i trudno go było zdjąć.

## 1. Werdykt

Kierunek jest sensowny, jeśli rozumiemy go jako **"wielu operatorów i wiele ścieżek dostępu do zwykłego HLS"**, a nie jako "film w sieci IPFS". Czysto zdecentralizowane przechowywanie (IPFS, Arweave) jest dobre na archiwum i dowód istnienia, ale słabo nadaje się do szybkiego startu odtwarzania. Szybkość daje cache blisko widza, a odporność daje to, że żaden pojedynczy podmiot (rejestrator, hoster, CDN) nie jest niezbędny.

## 2. Co faktycznie może zdjąć treść (punkty podatności)

1. Domena i DNS (rejestrator, rejestr TLD).
2. Konto u hostera (wyłączenie serwera).
3. CDN / reverse proxy.
4. Płatności (osobna notatka).
5. Wyszukiwarki, sklepy z aplikacjami, dostawcy poczty.
6. Dostawca certyfikatów i usługi trzecie (np. fonty, analityka).

Technologia przechowywania plików rozwiązuje głównie punkty 2 i 3. Punkty 1, 4 i 5 wymagają rozwiązań operacyjnych (kilka domen, kilka kont).

## 3. Co ustaliło badanie (2026-10-15)

Źródła częściowo wtórne, stan Odysee wymaga weryfikacji w komunikatach firmy.

- **Odysee/LBRY nie jest czysto zdecentralizowane w dostarczaniu wideo.** Repozytorium reflector (utrzymywane przez ludzi od Odysee) opisuje serwer przyjmujący bloby do magazynu obiektowego (S3/Wasabi) ze stanem w MySQL oraz warstwowe cache dyskowe łączone w łańcuch regionów, czyli w praktyce CDN. Blockchain trzyma indeks. https://git.pigg.es/LBRYFoundation/reflector.go/raw/branch/master/readme.md . Po upadku LBRY Inc. (SEC, 2023) Odysee przejęło Forward Research (2024) i rzekomo przenosi przechowywanie na Arweave; status niezweryfikowany w źródle pierwotnym.
- **IPFS ma realny problem z opóźnieniem przy wideo.** Badanie 28 tys. wideo na IPFS wskazuje częste przestoje z powodu wysokiego RTT, jedną jakość kodowania i słabe działanie standardowych algorytmów ABR, bo segmenty pochodzą od wielu peerów. https://researchconnect.suny.edu/en/publications/is-ipfs-ready-for-decentralized-video-streaming/ . Raporty operatorów: wolne serwowanie przypiętej treści bywa winą bramki/DNS, nie samego pinningu (4 do 10 s w jednym przypadku). https://discuss.ipfs.tech/t/ipfs-content-serving-slow-with-pinned-content/14398 . Brak świeżych benchmarków 2025 do 2026.
- **PeerTube** przeszło z WebTorrent na HLS z P2P; federacja (ActivityPub) i odciążanie łącza przez P2P to dwa osobne mechanizmy, a P2P służy dzieleniu obciążenia, nie redundancji danych. https://github.com/Chocobozzz/PeerTube/issues/5465 . Szczegółów WebRTC i p2p-media-loader nie potwierdzono, sprawdzić w dokumentacji PeerTube.
- **Odporność domeny.** Lustra na innych domenach działają tylko, jeśli można je stale zastępować nowymi; usługa onion (Tor) nie zależy od rejestratora ani CA, ale host pod spodem pozostaje słabym punktem (historia Hidden Wiki). Zalecane: osobne rejestratory i TLD, rozdzielone konta i dane rejestranta, nagłówek `Onion-Location`. https://safety.rsf.org/collateral-freedom-a-solution-for-media-outlets-to-bypass-censorship/ , https://bitcoincore.org/en/2020/03/27/hidden-service/

## 4. Porównanie technologii

| Opcja | Odporność | Szybkość startu | Rola u nas |
|---|---|---|---|
| Własny HLS na wielu originach | dobra (zależy od liczby operatorów) | bardzo dobra | **rdzeń** |
| Własne cache brzegowe (nginx/Varnish) + geo-DNS | dobra | bardzo dobra | **rdzeń** |
| Tani CDN jako jedna z opcji (nie jedyna) | średnia | bardzo dobra | opcjonalny |
| P2P w odtwarzaczu (WebRTC, p2p-media-loader) | niewielki wpływ | rośnie z widownią | dodatek odciążający |
| IPFS (własne węzły + bramka) | duża dla archiwum | słaba bez własnych bramek | archiwum |
| Arweave / Filecoin | bardzo duża (trwałe) | wolne | archiwum, dowód istnienia |
| PeerTube (federacja) | średnia | średnia | wzorzec, ewentualna integracja |
| Usługa onion (Tor) | duża dla domeny | wolna | awaryjny dostęp |

## 5. Architektura docelowa (gdyby kiedyś)

1. **HLS zostaje** (już mamy własny pipeline kodowania, wiele jakości, ABR działa).
2. **Multi-origin.** Te same segmenty u 2 do 3 operatorów w różnych jurysdykcjach (np. Hetzner + OVH + inny dostawca lub dedyk). Odtwarzacz zna listę originów i przełącza się przy błędzie segmentu.
3. **Własny edge.** 2 do 3 VPS z cache w kluczowych regionach, geo-DNS. Segmenty są niezmienne (`immutable`), więc cache jest bardzo skuteczny.
4. **Adresowanie po treści.** Nazwy segmentów to hash; manifest podpisany kluczem platformy, odtwarzacz weryfikuje, więc mirror nie musi być zaufany.
5. **P2P** w odtwarzaczu jako dodatek na hity. Wymaga serwera sygnalizacyjnego/trackera, który sam jest punktem do ochrony.
6. **Archiwum IPFS/Arweave** dla trwałości, z własnym pinningiem; nie ścieżka odtwarzania.
7. **Domena.** Kilka domen na różnych rejestratorach i TLD, lista mirrorów w PWA (aplikacja sama znajduje działający adres), wersja onion jako ostatnia deska ratunku. Dane rejestracyjne i konta rozdzielone, żeby jedno zajęcie nie wyłączyło całości.
8. **Kopie zapasowe niezależne od hostera** (osobny koszyk S3-compatible u innego dostawcy), szyfrowane.

## 6. Kolejność (od najtańszego)

1. Drugi origin + failover w odtwarzaczu.
2. Druga i trzecia domena + lista mirrorów w PWA.
3. Własny edge cache w 2 do 3 regionach.
4. Podpisane manifesty i adresowanie po hashu.
5. P2P w odtwarzaczu.
6. Archiwum IPFS/Arweave i usługa onion.

Koszt rzędu kilku do kilkunastu serwerów VPS (dziesiątki do niskie setki euro miesięcznie) zamiast jednego; główny koszt to utrzymanie i monitoring, nie licencje.

## 7. Ograniczenia i uwagi

- Odporność na cenzurę nie zwalnia z prawa: treści nielegalne, procedury DMCA/DSA i zgłoszenia nadużyć trzeba obsługiwać. Nasza moderacja, odwołania i bany widzów (CLAUDE.md §4.27) są tu zaletą, bo ograniczają ryzyko prawne, które najszybciej uderza w domenę, hoster i płatności.
- Im bardziej rozproszone, tym trudniej o szybkość, kontrolę kosztów i bezpieczeństwo kluczy. Stąd model hybrydowy zamiast czystego P2P.
- Treści z dostępem płatnym i prywatne wymagają podpisanych tokenów dostępu; multi-origin musi to zachować (mechanizm kontroli dostępu trzeba by odtworzyć na każdym originie).
- Uzasadnione wyjątki: nie szukamy tu sposobów na obejście orzeczeń sądowych ani na ukrywanie treści nielegalnych.

## 8. Otwarte pytania

- Ile realnie ruchu musi iść z kilku regionów, żeby opłacał się własny edge względem jednego CDN?
- Czy P2P ma sens przy naszej skali widowni (przy małej widowni daje niewiele)?
- Aktualny stan Odysee/Arweave (do sprawdzenia w pierwotnych komunikatach).
- Jak podpisywać tokeny dostępu między originami bez współdzielonego sekretu w każdym z nich.
