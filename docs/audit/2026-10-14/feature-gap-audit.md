# Audyt luk funkcjonalnych: serwis wideo vs minimum dojrzałej platformy

Data: 2026-10-14. Stan kodu: `main` po PR #1781 (etapy 0-8 platformy wielu twórców). Źródła: inwentaryzacja kodu (czytanie, bez uruchamiania) i badanie w sieci (`video-platform-feature-research.md`, ze źródłami i znacznikami `[niepotw.]`).
Legenda: **M** = musi być na dzień otwarcia dla zewnętrznych twórców, **S** = w ciągu ~6 miesięcy, **N** = miłe. Stan: **jest** / **część** (działa z ograniczeniem) / **model** (tabela bez UI) / **brak**.

## 1. Werdykt w trzech zdaniach

1. **Rdzeń jest mocny:** wgrywanie wieloczęściowe z kolejką kodowania HLS (5 jakości), własny odtwarzacz, komentarze z moderacją, telemetria bez cookies, panel admina z analityką, uprawnienia, moderacja i audyt na poziomie lepszym niż u większości małych platform.
2. **Brakuje „drugiej połowy” pętli twórcy:** twórca nie ma liczb (czas oglądania, retencja, subskrybenci), widz nie ma „moich subskrypcji”, powiadomień ani wznawiania, a płatności nie mają wejścia (route, UI).
3. **Są dwa realne błędy wielokanałowości**, które trzeba naprawić przed zaproszeniem zewnętrznych twórców: subskrypcja zawsze trafia do kanału głównego (sekcja 3) oraz „niepubliczny” film nie istnieje jako stan (sekcja 3).

## 2. Macierz luk

### A. Wgrywanie i zarządzanie filmem
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Wznawialny upload, limity pliku, kwoty kanału | jest | M | Wieloczęściowy do R2, 4 równoległe; limity wg poziomu zaufania |
| Limit długości filmu per kanał | model | M | `maxVideoSeconds` zapisany, niewymuszany (działa tylko globalny limit 6 h) |
| Statusy przetwarzania, kolejka, ponowienia | jest | M | Kolejka sprawiedliwa między kanałami |
| Miniatura własna / automatyczna | jest | M | Wybór klatki z filmu: brak (S) |
| Widoczność: prywatny/publiczny/zalogowani/zaplanowany | jest | M | Plus premiera i publikacja po przetworzeniu |
| Widoczność „niepubliczny” (tylko z linkiem) | **brak** (model w enumie, nic nie ustawia i nie serwuje) | M | Standard na każdej platformie; Studio już pokazuje etykietę i filtr |
| Flaga 18+ | część | M | `AGE_RESTRICTED` ustawia tylko moderator w panelu; twórca nie może zadeklarować |
| Opis, tytuł EN, tagi, kategoria | część | M | Tagi/kategoria zapisywane, ale nigdzie niewidoczne publicznie, nie w wyszukiwarce ani JSON-LD |
| Napisy (VTT) | część | M | Wgrywanie tylko w panelu admina, **nie w Studiu twórcy** |
| Tłumaczenia tytułu/opisu | część | S | Tylko panel; publicznie czytane tylko `titleEn/descriptionEn` |
| Rozdziały | brak | S | Najtaniej: parsowanie `0:00` z opisu + pasek w odtwarzaczu |
| Playlisty twórcy | brak | S | „Playlista” w UI to ręcznie układana lista boczna kanału głównego |
| Podmiana pliku z zachowaniem adresu | część | S | Backend jest (`VideoOriginal v+1`); w Studiu brak przycisku |
| Edycja zbiorcza, ustawienia domyślne uploadu | brak | S | |
| Przycinanie, import z URL, wykrywanie praw autorskich | brak | N | |
| Podgląd klatek przy suwaku (sprite) | brak | N | |

### B. Subskrypcje i powiadomienia
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Subskrypcja kanału (przycisk) | **błąd** | M | API nie przyjmuje identyfikatora kanału: każda subskrypcja idzie do kanału głównego (`app/api/subscriptions/route.ts`, `subscribe.use-case.ts`) |
| Strona „Moje subskrypcje” i feed | brak | M | `getUserSubscriptions` używa tylko panel |
| Powiadomienie e-mail o nowym filmie | brak | M | Jest rozsyłka ręczna z panelu (kanał główny); brak automatu po publikacji |
| Dzwonek / powiadomienia in-app | model | M | `Notification` jest zapisywane, brak odczytu i UI dla widza |
| Preferencje powiadomień | model | M | `NotificationPreference` tylko odczyt |
| Liczba subskrybentów dla twórcy, przyrost | brak | M | W Studiu brak licznika; w panelu tylko liczba |
| Ukrywanie licznika | model | S | `displaySubscribersCount` nieużywane publicznie |
| Digest, push web | brak | S/N | |
| RSS kanału, eksport CSV subskrybentów | brak | S | |
| Rozsyłka do kanału twórcy | brak | S | Rozsyłki i grupy odbiorców dotyczą tylko kanału głównego |

### C. Dane i analityka
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Zbieranie: wyświetlenia z progiem, czas oglądania, zdarzenia odtwarzania, telemetria | jest | M | Dobre dane wejściowe (`VideoView`, `VideoPlaybackEvent`, kolektor) |
| Co widzi twórca w Studiu | **brak** | M | Tylko `views` i liczba komentarzy |
| Wyświetlenia, czas oglądania, średni % per film i per okres | brak dla twórcy | M | Dane są; brak agregatów per kanał |
| Subskrybenci +/- w czasie | brak | M | Nie ma historii liczby (tylko bieżący licznik) |
| Retencja, źródła ruchu, kraje, urządzenia | część | S | W panelu admina dla filmu/serwisu; nie dla twórcy |
| Jawna aktualność danych | część | M | Panel ma „wiek danych”; Studio nie |
| Eksport CSV analityki | brak | S | Są eksporty audytu, płatności, użytkowników |
| Dochód twórcy | brak | M | Po włączeniu sprzedaży, patrz sekcja D |

### D. Widz
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Wznawianie oglądania („kontynuuj”) | **brak** | M | Wymaga zapisu pozycji (per użytkownik, po zalogowaniu; lokalnie dla gościa) |
| Historia, „obejrzyj później” | brak | S | |
| Polubienia, komentarze, udostępnianie | jest | M | Pełne, z moderacją i trybem komentarzy |
| Link z czasem (`?t=`) | brak | M | |
| Wyszukiwarka | część | M | Tylko kanał główny, bez filtrów; tagi i kategorie nieindeksowane; kanały po nazwie są |
| Strona filmu (osobny adres) | część | M | `/watch/<slug>` przekierowuje na stronę główną z `?v=`; działa, ale nie jest osobną stroną (SEO, osadzanie) |
| Strona kanału | część | M | Jedna zakładka, brak „O kanale”, banera, linków |
| Odtwarzacz: jakość ręczna, prędkość, PiP, autoplay następnego | brak | M (jakość, prędkość) / S | Dziś: napisy, pełny ekran, ABR automatyczny |
| Embed (iframe), oEmbed | brak | S | Osadzanie celowo zablokowane (CSP `frame-ancestors`) |
| RSS | brak | S | |
| SEO: sitemap, OG, JSON-LD VideoObject | jest | M | W trybie beta sitemap pusta i strony noindex (`NEXT_PUBLIC_SITE_BETA`) |
| Rekomendacje „podobne” | brak | S | |

### E. Konto i kanał
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Ustawienia konta, 2FA, passkeys, sesje, eksport i usunięcie danych | jest | M | Pełne |
| Zakładanie kanału | za wyłącznikiem | M | `invite`; wymaga listy zaproszeń |
| Awatar kanału | część | M | Kolumna `Creator.avatarUrl` martwa; awatar to zdjęcie konta właściciela; brak uploadu |
| Baner kanału, linki, „O kanale” | brak | S | |
| Odznaka weryfikacji | model | S | `isVerified` nic nie ustawia |
| Role w kanale i zaproszenia (manager/edytor/moderator) | model | S | Uprawnienia egzekwowane, ale tylko wiersz OWNER istnieje, brak UI zaproszeń |
| Przywrócenie kanału z poziomu Studia | część | S | API jest, brak przycisku |
| Widok „moje powiadomienia i preferencje” | brak | M | Patrz B |

### F. Zaufanie, prawo, moderacja
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Zgłoszenie komentarza | jest | M | |
| Zgłoszenie filmu / kanału | część | M | API obsługuje film, UI tylko „zgłoś kanał”; brak przycisku pod filmem |
| Uzasadnienie decyzji dla twórcy (DSA art. 17) | część | M | `ModerationDecision` zapisywane, twórca nie widzi i nie dostaje powiadomienia |
| Odwołanie od decyzji (DSA art. 20) | **model** | M | Pola `appealedAt/appealNote` bez użycia; brak formularza i kolejki |
| Procedura praw autorskich (notice and takedown) | brak | M | Formularz + kontakt + counter-notice |
| Blokada widza na kanale (`ChannelBan`) | model | M | Zero użycia |
| Lista słów, hold-all per film, zatwierdzani użytkownicy | część | S | Tryb ON/HELD/OFF jest; reszta nie |
| 2FA twórców | jest | M | Dostępne dla wszystkich kont; nie wymuszane przed wypłatą |
| Strajki | jest | S | Ostrzeżenia z wygasaniem w panelu |

### G. Monetyzacja
| Funkcja | Stan | Pr. | Uwagi |
|---|---|---|---|
| Napiwki (Stripe, BLIK, P24) | jest | S | Zawsze na kanał główny; twórca zewnętrzny ich nie ma |
| Płatny dostęp do filmu | **logika bez wejścia** | M (jeśli model biznesowy) | `sales` jest, ale żadna trasa/webhook/UI go nie woła; Studio nie oferuje PAID |
| Wypłaty, dane podatkowe, KYC | brak | M (przed sprzedażą) | Zależne od decyzji o podmiocie i VAT |
| Faktury / dokumenty | brak | M (przed sprzedażą) | |
| Panel przychodów twórcy | brak | M (przed sprzedażą) | |

## 3. Błędy i niespójności znalezione przy audycie (do naprawy niezależnie od priorytetów)

1. **Subskrypcja ignoruje kanał** (krytyczne dla wielu twórców). `POST/DELETE /api/subscriptions` nie ma identyfikatora kanału, więc przycisk na stronie cudzego kanału subskrybuje kanał główny. Stan początkowy przycisku jest natomiast czytany per kanał, więc wygląda jakby działał.
2. **`UNLISTED` jest martwy.** Enum, etykieta i filtr w Studiu są, ale nic nie ustawia tego statusu, a publiczne zapytania biorą tylko `PUBLISHED`. Twórca nie ma „linku do znajomych”.
3. **Napisy tylko w panelu**: twórca z Studia nie wgra własnych napisów, choć odtwarzacz je obsługuje.
4. **Limit długości filmu per kanał nie jest egzekwowany** (tylko wartość w bazie).
5. **`Creator.avatarUrl` martwa kolumna**: twórca ma awatar swojego konta, nie kanału.
6. **Rozbieżność limitów opisu kanału** (UI 1000, schemat 1500).
7. **Tagi i kategoria zapisywane, nigdzie niepokazywane** (użytkownik uzna to za usterkę).
8. **Powiadomienia in-app zapisywane bez żadnego odczytu** (rosnąca tabela, brak ekranu).

## 4. Proponowana kolejność prac

**Fala 1: spójność wielokanałowa (mały koszt, duża waga):**
subskrypcja per kanał + „Moje subskrypcje”; „niepubliczny” jako prawdziwy stan; napisy w Studiu; egzekwowanie długości; awatar kanału (upload); „zgłoś film” pod filmem; test całej ścieżki zakładania kanału z drugiego konta.

**Fala 2: pętla twórcy i widza:**
analityka twórcy w Studiu (wyświetlenia, czas, średni %, subskrybenci w czasie, jawna aktualność); powiadomienia (dzwonek + e-mail o nowym filmie + preferencje); wznawianie oglądania i link z czasem; jakość i prędkość w odtwarzaczu; odwołania od decyzji i widok uzasadnienia dla twórcy; blokada widza na kanale.

**Fala 3: odkrywanie i zasięg:**
osobna strona filmu (SEO, embed/oEmbed), rozbudowana strona kanału (baner, „O kanale”, linki), wyszukiwarka po kanałach z tagami i kategoriami, playlisty, rozdziały, RSS.

**Fala 4: pieniądze (po decyzjach prawnych):**
adapter płatności i webhook, ekran zakupu, panel przychodów twórcy, wypłaty z progiem i danymi podatkowymi, faktury, 2FA jako warunek wypłat. Wymaga decyzji o podmiocie, rejestracji VAT i porady prawnej (DSA, VAT OSS, DAC7).

## 5. Zastrzeżenia

- Inwentaryzacja pochodzi z czytania kodu, nie z uruchamiania aplikacji; stany „jest” oznaczają, że kod i testy istnieją, nie że ekran był oglądany w przeglądarce.
- W badaniu w sieci część oficjalnych stron YouTube zwróciła 404, a dane o Dailymotion, Odysee, Rumble i Nebula są wtórne; liczby finansowe konkurentów mogą być nieaktualne. Priorytety M/S/N to ocena autora na podstawie wzorców, nie fakt rynkowy.
- Obowiązki prawne (DSA, prawa autorskie, VAT) wymagają potwierdzenia u prawnika i doradcy podatkowego przed uruchomieniem sprzedaży.
