# D03 — tożsamość i sesje

1 listopada 2026, partia 02. **W_TRAKCIE.** Badany kod: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. Nie uruchomiono pełnej aplikacji ani nie sprawdzono produkcyjnej konfiguracji Cloudflare, Google i Better Auth.

## Wniosek dla właściciela

Polutek ma sensowne zabezpieczenia kont: centralne rozpoznawanie użytkownika, ponowny odczyt roli z bazy, osobne konta panelu, weryfikację podpisanych tokenów panelu i kontrolę potwierdzenia użytkownika przy passkey. Tych mechanizmów nie trzeba wyrzucać tylko dlatego, że powstały z pomocą AI.

Nie mamy jednak jeszcze dowodu, że cała ścieżka logowania, odzyskania konta i cofnięcia dostępu działa prawidłowo w przeglądarce. Istotne decyzje wymagające oceny przed otwarciem dużej platformy to: 12-godzinna świeżość potwierdzenia w panelu Access (R13), przepuszczanie prób logowania podczas awarii liczników Redis (R14), 60-sekundowy cache sesji WWW i uznawanie Google za wystarczająco silne logowanie bez osobnego sprawdzenia, czy użyto drugiego składnika. Ostatnie dwie pozycje są pytaniami do weryfikacji, nie nowymi dowiedzionymi przejęciami kont.

## Cztery różne pojęcia administratora

| Tożsamość | Źródło | Co sprawdzono |
|---|---|---|
| Zwykły użytkownik WWW | Better Auth → `User` | `auth()` ustala ID; resolver ponownie czyta `role`, `isDeleted`, `onboardingPending` |
| Legacy ADMIN na WWW | `User.role=ADMIN` | Uprawnienia wynikają z aktualnej bazy, a nie roli przesłanej w sesji |
| Operator panelu | Osobny `AdminUser`, OWNER/TRANSLATOR | Access JWT albo starsza sesja panelu; domyślny guard dopuszcza OWNER |
| Członek kanału | `ChannelMember` i rola kanałowa | Studio zawsze tworzy aktora `user`, także dla legacy ADMIN; dalsze reguły w [D04](D04-ROLE-I-IZOLACJA.md) |

Konto panelu nie jest automatycznie kontem twórcy. Sam napis „admin” w nazwie funkcji nie wyjaśnia, do której tożsamości odnosi się operacja.

## Rozpoznanie użytkownika i cofnięcie roli

[Serwerowy adapter sesji](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/server.ts) wywołuje Better Auth. Przy `fresh:true` ustawia `disableCookieCache:true`. Błąd odczytu zamienia na brak zalogowania; nie przyznaje uprawnień w razie awarii. Ma to koszt operacyjny: użytkownik może zobaczyć zachowanie gościa zamiast jasnego komunikatu o niedostępności logowania.

[Resolver aktora WWW](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/auth.ts) odczytuje bieżącego `User`. Brak konta albo `isDeleted=true` daje 403. Odczyt roli przy każdym wywołaniu usuwa istotną klasę ryzyka: stara informacja o ADMIN w ciasteczku nie wystarcza do zachowania tej roli. `requireAdminActor()` dodatkowo wymaga świeżego odczytu sesji.

W [kontrolowanym eksperymencie](../evidence/identity-context-experiment.json) rzeczywisty resolver zwrócił `user` dla wiersza USER, odmówił kontu usuniętemu i przekazał `fresh:true` dla żądania administratora. To wywołanie funkcji z atrapą auth/bazy. Nie jest odtworzeniem democji z prawdziwym starym ciasteczkiem, pomimo skróconej nazwy scenariusza w JSON.

## Ustawienia i cykl konta

[Konfiguracja](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/config.ts) i [instancja Better Auth](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/auth.ts) deklarują:

- Hasła 10–128 znaków, wymagane potwierdzenie adresu dla hasła, tokeny e-mail przez godzinę. Reset hasła unieważnia sesje; hook zmiany hasła wymusza unieważnienie pozostałych sesji.
- Sesja WWW: `expiresIn=30 dni`, odświeżanie co dobę, `freshAge=24 h`, cache cookie 60 s. Parametr expiresIn nie dowodzi bezwzględnego limitu od pierwszego logowania przy odświeżanej sesji. Trzeba zbadać timeout bezczynności i limit całkowity oddzielnie.
- Produkcyjne ciasteczka Secure/HttpOnly/SameSite=Lax, lista zaufanych originów, osobne ustawienia panelu. Nie przechwycono rzeczywistych nagłówków HTTP.
- Plugin haseł ujawnionych w wyciekach w produkcji; CAPTCHA tylko przy skonfigurowanym kluczu; Google tylko przy komplecie kluczy. Nie sprawdzono aktywnej konfiguracji ani zachowania tych usług przy awarii.
- TOTP dla logowania hasłem; Google/One Tap oraz passkey nie dostają dodatkowego kroku TOTP. Nie oznacza to, że każde konto Google ma włączone MFA. Przed doborem wymagań ASVS potrzebujemy jawnego profilu siły każdej metody, w tym odzyskiwania konta.

[Hooki](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/hooks.ts) blokują utworzenie sesji usuniętego konta. Przy podłączeniu zaufanego dostawcy do niezweryfikowanego konta usuwają poprzednie hasło, passkeys i sesje. To celowa obrona przed zarezerwowaniem cudzego adresu przez napastnika. Zmiana e-maila wymaga dodatkowej weryfikacji i potwierdzenia starego adresu. Poprawności kolejności hooków, transakcji i wyścigów całego OAuth nie potwierdzono przez HTTP.

## Passkeys: odrzucone zbyt szybkie podejrzenie

W konfiguracji WebAuthn jest `userVerification:"preferred"`. Sam ten zapis mógłby sugerować dopuszczenie klucza bez PIN/biometrii. Jednak [kod obsługi](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/passkey-signup.ts) wywołuje `assertPasskeyUserVerified` po rejestracji i uwierzytelnieniu. [Kontrola](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/passkey.ts) odrzuca brak flagi UV. Dziesięć istniejących testów tego helpera przeszło, w tym odmowa dla false/undefined. Nie potwierdza to całej ceremonii ani odporności na ponowne użycie challenge.

Dodawanie/usuwanie klucza wymaga sesji młodszej niż 24 h. Należy ocenić, czy dla konta twórcy z pieniędzmi jest to wystarczające ponowne potwierdzenie. „Świeża sesja” jest parametrem produktu, a nie uniwersalną gwarancją bezpieczeństwa.

## Panel i R13

[Weryfikator Access](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/security/cf-access.ts) sprawdza RS256, issuer i audience przy pomocy jose; ważność `exp`, jeżeli claim występuje, podlega walidacji biblioteki. Nie ma lokalnego `requiredClaims` wymuszającego obecność exp/iat — faktyczny format i czas życia poprawnie podpisanych tokenów Cloudflare należy potwierdzić w konfiguracji i teście. E-mail pochodzi z podpisanego payload, nie z samego nagłówka z adresem. 13 istniejących testów przeszło, w tym błędny podpis/issuer/audience i przeterminowanie. Nie testowano zewnętrznego JWKS ani rzeczywistego Access.

[Resolver panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/auth/access-session.ts) ponownie sprawdza token i odczytuje rolę AdminUser; nieznany adres bez konta odrzuca. Automatycznie utworzyć OWNER może jedynie adres właściciela po udanej weryfikacji Access. Błąd mapowania konta zamyka dostęp. [Proxy](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/proxy.ts) dodaje sprawdzenie originu mutacji oraz ograniczenie ścieżek tłumacza. Trzeba jeszcze rozliczyć każdy handler i każdą Server Action niezależnie od proxy.

**R13 potwierdzone jako różnica polityki w kodzie:** [guard](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/auth/guard.ts) uznaje token Access wydany do 12 h temu za świeże potwierdzenie wrażliwego działania. Starszy tryb passkey/TOTP ma okno 5 minut. To nie jest dowód obejścia logowania ani odczyt konfiguracji produkcji. To dużo dłuższa możliwość wykonania wrażliwego działania po przejęciu już otwartej sesji. Warunek przyszłej poprawy: osobny profil ryzyka refundów, usuwania, eksportów i ról oraz pomiar ponownego potwierdzenia po przekroczeniu ustalonego progu. Nie zmieniono decyzji właściciela w implementacji.

## R14: działanie podczas awarii Redis

[Magazyn liczników auth](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/auth/rate-limit-storage.ts) przy błędzie przepuszcza żądanie, a liczniki zwracają 0. Trzy istniejące testy awarii/timeout przeszły. **R14 potwierdzone w zakresie tego mechanizmu**, nie jako udowodnione przejęcie konta. CAPTCHA i wymaganie hasła pozostają odrębnymi kontrolami; sam kod mówi, że licznik TOTP jest w bazie. Pełnej odporności tych zabezpieczeń przy awarii nie sprawdzono. Dla dużej platformy potrzebny jest test limitów na brzegu, monitorowania awarii i wyboru kontrolowanej degradacji.

## Cofnięcie sesji — otwarta weryfikacja

Cache cookie WWW wynosi 60 s. Bieżący odczyt User chroni przed nieaktualną rolą i `isDeleted` w badanych resolverach, ale sam nie sprawdza, czy konkretny token sesji usunięto z bazy. Trzeba zapisać komplet cookie, wylogować/unieważnić na drugim urządzeniu i odtworzyć stare cookie natychmiast oraz po TTL. Powtórzyć dla resetu hasła, zmiany hasła, usunięcia konta i panelu Access. Nie potwierdzono jeszcze czasu rzeczywistego cofnięcia; nie wolno opisywać go jako „natychmiastowego” na podstawie samego usunięcia wiersza sesji. Nie mylić z tokenami wideo z R07.

## Dowody, PeerTube i wymagane domknięcie

[Podsumowanie przebiegów](../evidence/identity-authz-review.json), [pierwszy JSON Vitest](../evidence/identity-authz-vitest.json), [drugi JSON Vitest](../evidence/auth-failure-passkey-vitest.json), [eksperyment źródłowy](../evidence/identity-context-experiment.json). Razem 18 plików testowych: 10 przeszło w całości, 1 zakończył się dwoma błędami sprawdzeń enumów, 7 zatrzymało się przy ładowaniu. Zarejestrowano 123 testy: 121 przeszło, 2 nie przeszły z powodu brakujących enumów wygenerowanego klienta. Liczba 123 nie obejmuje przypadków z plików, które nie załadowały się. Eksperyment jest osobnym dowodem, nie zaliczeniem zablokowanych testów.

W PeerTube [testy sesji OAuth](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/users/oauth.ts#L380) po cofnięciu tokenu wykonują prawdziwe `getMyInfo` z oczekiwaniem 401; są też scenariusze restartu serwera. [Testy 2FA](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/users/two-factor.ts) uruchamiają instancję i sprawdzają limit błędnych haseł. Przeczytano ich kod, nie wykonano ich w tym środowisku. To konkretny wzorzec dla testów Polutka, nie dowód ogólnej wyższości zabezpieczeń PeerTube.

Sprawdzone online metody OWASP: WSTG v4.2 [wylogowanie](../sources/wstg-v42-logout.md) i [blokada prób](../sources/wstg-v42-lockout.md); [zapis pobrania](../sources/fetch-identity-authz.json). Do testów nie należy kopiować bez oceny wszystkich historycznych sugestii WSTG, np. jednego limitu minut dla każdego produktu. W ASVS rozpoczęto konkretne wymagania, ale żadnego nie ogłoszono zaliczonym w skali całej aplikacji.

Do zamknięcia D03: wszystkie metody rejestracji/logowania/łączenia kont, reset i zmiana adresu, odzyskiwanie 2FA, hasła i hash/KDF, limity IP/konta, cookie i rotacja sesji, wszystkie tryby panelu, awarie dostawców, replay, odzyskiwanie konta właściciela oraz pełne testy HTTP. Scenariusze zapisano w [macierzy](../SCENARIUSZE-D03-D04.csv).
