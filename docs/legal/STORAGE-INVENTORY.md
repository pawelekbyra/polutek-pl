# Inwentarz cookies i pamięci przeglądarki (stan kodu)

Źródło prawdy dla § 6 Polityki prywatności. Pilnuje go test `tests/unit/legal-storage-inventory.test.ts`:
każdy klucz `localStorage`/`sessionStorage` i każde cookie ustawiane przez aplikację musi tu być wymienione.
Dodając nowy klucz, dopisz go tutaj i sprawdź, czy § 6 Polityki nadal jest prawdziwy.

Zasada (art. 399 PKE, od 10.11.2024, i wytyczne EROD 2/2023): zapis w urządzeniu bez zgody tylko wtedy, gdy jest
niezbędny do usługi, o którą prosi użytkownik. Zapisy poniżej są funkcjonalne, powstają po działaniu widza
albo służą wyłącznie jego własnym ustawieniom. Telemetria strony (`/api/t`, kolektor `pp-collector`) nie zapisuje
nic na urządzeniu.

## Cookies

| Nazwa | Ustawia | Cel | Czas | Kiedy |
|---|---|---|---|---|
| `pp.*` (`__Secure-pp.session_token`, `pp.two_factor`, `pp.trust_device`, ...) | Better Auth | sesja i kroki logowania | sesja do 30 dni; zaufane urządzenie 7 dni (opt-in) | po zalogowaniu |
| `app-language` | aplikacja | wybrany język | rok | po wejściu/zmianie języka |
| `__stripe_mid`, `__stripe_sid` | Stripe.js | ochrona płatności przed nadużyciami | do roku / 30 min | dopiero po otwarciu bramki napiwkowej (`@stripe/stripe-js/pure`) |
| `g_state` | Google Identity Services | limit i stan okna One Tap | do roku | dopiero po otwarciu okna logowania |

Cloudflare Turnstile (formularze logowania) nie używa cookies.

## Pamięć przeglądarki

| Klucz | Rodzaj | Cel |
|---|---|---|
| `app-language` | localStorage | język (kopia cookie) |
| `polutek:player-sound` | localStorage | wybór dźwięku odtwarzacza |
| `polutek:captions` | localStorage | napisy wyłączone przez widza |
| `polutek:player-quality` | localStorage | jakość obrazu wybrana przez widza w menu odtwarzacza |
| `polutek:player-rate` | localStorage | prędkość odtwarzania wybrana przez widza (brak wpisu = 1x) |
| `polutek:watch-progress` | localStorage | miejsce, w którym niezalogowany widz przerwał oglądanie (ID filmów, pozycja i czas; do 30 filmów), do wznowienia |
| `polutek:playlist-autoplay` | localStorage | włączone/wyłączone automatyczne przejście do kolejnego filmu playlisty |
| `cockpit-sound` | localStorage | dźwięk kokpitu premiery |
| `tip-last-method` | localStorage | ostatnia metoda napiwku |
| `polutek:email-consent-prompt-dismissed:<userId>` | localStorage | nie pokazuj ponownie prośby o zgodę e-mail (zawiera ID konta) |
| `polutek:revealed` | sessionStorage | bramka wejścia pokazana w tej karcie |
| `pp:tip-attempt-id` | sessionStorage | wznowienie próby napiwku po przekierowaniu |
| `pp:patron-attempt-id` | sessionStorage | wznowienie próby zakupu dostępu patrona po zamknięciu i otwarciu okna płatności |
| `pp:comment-target` | sessionStorage | identyfikator komentarza z linku (`#comment-...`) i czas, by po wejściu przewinąć do niego; ważny minutę |
| `sso-return-to` | sessionStorage | powrót na stronę po logowaniu Google |

Poza zakresem publicznej strony: wznowienie uploadu w panelu administratora (`multipart-uploader`).
