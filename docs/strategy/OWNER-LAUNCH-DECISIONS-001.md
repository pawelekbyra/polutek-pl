# OWNER-LAUNCH-DECISIONS-001 — Launch-blocking owner decisions

Date: 2026-06-12
Owner: Paweł Perfect
Status: DECIDED
Implementation status: NOT IMPLEMENTED / PARTIAL
Legal status: PROFESSIONAL REVIEW REQUIRED
Launch status: NO_GO

## A. Tożsamość produktu i napiwki

### OWNER DECISION
- Polutek.pl jest osobistym serwisem jednego twórcy i jednej społeczności.
- Twórcą i prowadzącym serwis jest Paweł Perfect.
- Napiwek jest dobrowolnym wsparciem twórcy.
- Napiwek nie jest cykliczną subskrypcją.
- Napiwek nie jest zakupem konkretnego filmu.
- Twórca nie obiecuje konkretnej liczby materiałów ani harmonogramu publikacji.
- Dostęp do Strefy Patrona jest podziękowaniem za skutecznie przyjęte wsparcie.
- Nie używaj kategorycznej kwalifikacji prawnej lub podatkowej „darowizna”.
- Publiczne teksty mają używać przede wszystkim określeń:
  - `napiwek`
  - `dobrowolne wsparcie twórcy`
  - `Strefa Patrona jako podziękowanie`
- Ostateczna kwalifikacja prawna i podatkowa wymaga profesjonalnej weryfikacji.

### LEGAL REVIEW REQUIRED
- Professional verification of legal and tax qualification of tipping model.

## B. Minimalna kwota i waluty

### OWNER DECISION
- Minimalny napiwek to 10 jednostek każdej aktywnej waluty.
- Launch defaults:
  - 10 PLN
  - 10 EUR
  - 10 USD
  - 10 GBP
  - 10 CHF (jeśli CHF pozostaje aktywne w runtime).
- Kwoty nie są wyrównywane według kursu walut (zasada „dychy” w każdej walucie).
- Bramka napiwkowa nie pozwala skutecznie zapłacić mniej niż aktywne minimum.
- Każda skutecznie przyjęta płatność spełniająca minimum może prowadzić do nadania PatronGrant.
- Próg pozostaje technicznie konfigurowalny per waluta.

## C. Dostęp Patrona

### OWNER DECISION
- Dostęp nie wygasa z upływem czasu i nie wymaga kolejnych wpłat.
- „Lifetime” oznacza: bezterminowo, bez cyklicznych opłat, tak długo, jak funkcjonują Polutek.pl i Strefa Patrona.
- Nie oznacza gwarancji istnienia serwisu przez całe życie użytkownika.
- Kolejny napiwek nie przedłuża dostępu; jest kolejnym dobrowolnym wsparciem.
- Active PatronGrant pozostaje źródłem prawdy dostępu.

## D. Zwroty i spory

### OWNER DECISION
- Polutek.pl nie oferuje częściowych zwrotów jako standardowej funkcji produktu.
- Właściciel może indywidualnie przyznać pełny zwrot.
- Obowiązujące bezwzględnie prawa użytkownika nie są ograniczane.
- Pełny zwrot co do zasady cofa powiązany PatronGrant.
- Dispute opened zawiesza grant.
- Dispute resolved in creator’s favor przywraca grant.
- Chargeback lub dispute zakończony utratą płatności cofa grant.
- Nieoczekiwany częściowy refund nie może po cichu zmieniać dostępu:
  - Ma zostać oznaczony jako przypadek unsupported/manual review.
  - Agent nie może samodzielnie wymyślać automatycznej polityki.
- Nie przedstawiaj napiwków absolutnie jako „nigdy niepodlegających zwrotowi”.

### IMPLEMENTATION REQUIRED
- Logic to handle "unexpected partial refund" as manual review/unsupported case.

## E. Społeczność i moderacja

### OWNER DECISION
- Strefa Patrona jest moderowaną społecznością.
- Właściciel może usuwać komentarze, ograniczać komentowanie, zawieszać konto lub cofać dostęp z ważnej przyczyny (np. spam, nękanie, treści bezprawne, oszustwo, podszywanie się, obchodzenie zabezpieczeń, uporczywe zakłócanie społeczności).
- Sankcja za złe zachowanie nie powoduje automatycznego zwrotu historycznego napiwku.
- Konto nie może zostać usunięte całkowicie arbitralnie bez żadnej przyczyny.
- Krytyka twórcy sama w sobie nie jest podstawą sankcji.

## F. Trzy klasy wiadomości e-mail

### OWNER DECISION

#### F1. System / transactional
- Nie zależą od przycisku `Subskrajb`.
- Rejestracja, napiwek ani PatronGrant nie mogą włączać subskrypcji treści.
- Domyślne zdarzenia (docelowe identyfikatory):
  - `WELCOME`: pierwsza rejestracja przez Clerk.
  - `FIRST_TIP_AND_PATRON_GRANTED`: pierwszy skuteczny napiwek (połączony mail).
  - `TIP_RECEIVED`: kolejny napiwek (podziękowanie).
  - `ACCOUNT_DELETED`: usunięcie lub anonimizacja konta.
  - `FULL_REFUND_AND_ACCESS_REVOKED`: pełny refund i cofnięcie dostępu.
  - `DISPUTE_OPENED_ACCESS_SUSPENDED`: dispute opened i zawieszenie dostępu.
  - `DISPUTE_WON_ACCESS_RESTORED`: dispute won by creator i przywrócenie dostępu.
  - `CHARGEBACK_ACCESS_REVOKED`: chargeback/dispute lost i cofnięcie dostępu.
  - `PASSWORD_CHANGED`: wysyłany tylko jeśli nie dubluje Clerk.
- Pierwsza wpłata nie może generować dwóch osobnych maili `thank-you` i `become-patron`.

#### F2. Content notifications
- Przycisk `Subskrajb / Subscribe` oznacza wyłącznie zgodę na powiadomienia o nowych treściach i istotnych nowościach Polutek.pl.
- Brak reklam, sponsorowanych ofert, promocji innych firm czy profilowanych reklam.
- Dane nie są sprzedawane ani udostępniane do celów reklamowych.
- Wymagany osobny, świadomy opt-in (checkbox nie może być domyślnie zaznaczony).
- Rejestracja, napiwek ani PatronGrant nie włączają content notifications.
- Wypisanie nie cofa PatronGrant.
- Każda wiadomość zawiera bezpieczny link wypisania działający bez logowania.
- Nazewnictwo docelowe: `CONTENT_NOTIFICATIONS` (lub istniejące `EMAIL_NOTIFICATIONS`).
- Nie nazywać tej funkcji marketingiem w publicznym UX.

#### F3. Referral notifications
- Jeden szablon z parametrami postępu 1/5–4/5.
- Wysyłanie maila po każdym poleceniu domyślnie wyłączone (admin-toggle).
- System liczy polecenia nawet jeśli maile są wyłączone.
- Mail 5/5 (osiągnięcie celu i nadanie dostępu) jest domyślnie włączony.

### CURRENT IMPLEMENTATION OBSERVATION
- Istniejące pola lub statusy nazwane `marketingEmails` wymagają późniejszego audytu/migracji semantycznej.

### IMPLEMENTATION REQUIRED
- Consolidating `thank-you` and `become-patron` emails for the first payment.
- Logic to prevent automatic subscription on registration/tipping.
- Logic to ensure system emails don't override opt-out.

## G. Zarządzanie szablonami e-mail

### OWNER DECISION
- Każdy wspierany mail systemowy ma osobny szablon w panelu administratora.
- Szablon zawiera: slug, nazwę, opis, temat PL/EN, HTML PL/EN, podgląd PL/EN, zmienne, `isActive`, test-send, historię.
- Administrator może edytować HTML (wymagana sanityzacja).
- Wyłączenie krytycznego maila wymaga potwierdzenia i pokazuje ostrzeżenie.
- Runtime musi respektować `isActive`.
- Brak szablonu nie może przerwać krytycznego webhooka (płatności/Clerk).
- Wysyłka musi być idempotentna.

### CURRENT IMPLEMENTATION OBSERVATION
- Istnieje adminowy edytor szablonów PL/EN z HTML i preview.
- Istnieje `isActive`, ale wymaga potwierdzenia, że runtime go respektuje.
- Istnieją systemowe szablony m.in. welcome, donation, patron, account deletion i password changed.

### IMPLEMENTATION REQUIRED
- Ensure runtime respects `isActive`.
- Implement safety to prevent webhook failure on missing template.
- Implement idempotency for email sending.

## H. Resend i granice subskrypcji

### OWNER DECISION
- Systemowy mail nie może automatycznie dodawać odbiorcy do Resend Audience ani ustawiać `unsubscribed: false`.
- Synchronizacja do Resend Audience tylko po świadomym włączeniu content notifications.
- Późniejszy mail systemowy nie może cofnąć wcześniejszego wypisania.
- Link unsubscribe nie może zawierać jawnego e-maila w query string (użyć podpisanego tokenu).
- Bounce i complaint suppression pozostają launch-critical.
- Complaint nie może zostać automatycznie wyzerowany przez ponowną synchronizację.
- Test-send administratora jest dozwolony.
- Support replies są oddzielne od content notifications.

### CURRENT IMPLEMENTATION OBSERVATION
- Obecny legacy email bridge może synchronizować odbiorcę każdego maila do Resend Audience.
- Obecny unsubscribe link może zawierać jawny e-mail.

### IMPLEMENTATION REQUIRED
- Signed/secure unsubscribe tokens.
- Audit broadcast mechanism to ensure it doesn't bypass opt-in or treat missing preference as consent.

## I. Język strony i wiadomości

### OWNER DECISION
- Obsługiwane języki: `PL` i `EN`.
- `User.language` jest kanonicznym źródłem prawdy.
- Anonimowi użytkownicy: `pl` dla Polski/polskiej przeglądarki, `en` w pozostałych przypadkach.
- Geolokalizacja tylko do początkowego wyboru (brak profilowania).
- Ręczna zmiana języka ma zawsze pierwszeństwo, zapisuje wybór lokalnie i (dla zalogowanych) w bazie.
- Pierwszy mail powitalny musi respektować wybór użytkownika.
- Mail o usunięciu konta używa języka sprzed anonimizacji.

### CURRENT IMPLEMENTATION OBSERVATION
- `User.language` i endpoint aktualizacji języka istnieją.
- Część ścieżek mailowych może nie pobierać języka przed anonimizacją.
- Clerk webhook ma domyślny fallback języka wymagający audytu.

### IMPLEMENTATION REQUIRED
- Audit Clerk webhook language fallback.
- Ensure language is captured before account deletion for the final email.

## J. Prywatność

### OWNER DECISION
- Brak modelu reklamowego, brak sprzedaży danych, brak profilowania reklamowego.
- Dane używane tylko do: konta, bezpieczeństwa, funkcji serwisu, płatności, dostępu, moderacji, content notifications, wiadomości systemowych i obowiązków prawnych.
- Polityka prywatności: krótka, prosty język, ale bez ukrywania providerów.
- Przed publikacją wymagany runtime/provider inventory.
- Brak przechowywania pełnych danych kart płatniczych (używanie Stripe).

### LEGAL REVIEW REQUIRED
- Review of privacy policy and data processing transparency.

## K. Dane prowadzącego i kontakt

### OWNER DECISION
- Prowadzący serwis: Paweł Perfect
- Kontakt: `support@polutek.pl` (obsługuje wszystkie sprawy).
- Adres do korespondencji: Złota 75A/7, 00-819 Warszawa.
- Nie używać terminów: zespół, firma, SLA, siedziba.
- Prosta formuła: `Kontakt w sprawach działania serwisu: support@polutek.pl`.

### LEGAL REVIEW REQUIRED
- Verification if "Paweł Perfect" and the virtual office address are sufficient identification under applicable law.

## L. Operacje, backup i alerty

### OWNER DECISION
- RPO: 24 godziny, RTO: 48 godzin (cele wewnętrzne).
- Backup bazy: codziennie, retencja 30 dni.
- Restore drill: przed startem, kwartalnie, po zmianach infra.
- Kanał alertów: `support@polutek.pl`.
- Krytyczne alerty: niedostępność produkcji, błędy webhooków (Stripe, Cloudflare), błędy bazy, awarie backupu, awarie logowania, wyciek sekretu, błędy wysyłki e-mail.
- Rate limity: chronią przed nadużyciem, nie blokują zwykłego użytkowania.

### OPERATOR EVIDENCE REQUIRED
- Successful restore drill evidence.
- Monitoring/alerting setup verification.

## M. Cloudflare i pliki wideo

### OWNER DECISION
- Cloudflare Stream jako provider playbacku.
- Prywatne oryginały muszą istnieć poza Cloudflare (nie jest to jedyna kopia).
- Aktywny materiał nie jest usuwany tylko z powodu kosztów.
- 30-dniowy okres bezpieczeństwa przed usunięciem wycofanego materiału z Cloudflare.
- Właściciel ponosi koszty działania Stream.
- Po pierwszym miesiącu: pomiar kosztu, ustawienie ostrzeżeń.

### OPERATOR EVIDENCE REQUIRED
- Verification of original video files backup outside Cloudflare.

## N. Zakres launchu i X6

### OWNER DECISION
- Launch wymaga wersji PL i EN.
- Launch-critical: główny UX, logowanie, płatności, Patron Zone, locked states, subskrypcja, unsubscribe, komentarze, błędy, kontakt, dokumenty.
- Reakcje/hearts: nie są launch-critical.
- Minimalna macierz ekranów: 360, 390, 768, 1024, 1440 px.
- Minimalna macierz przeglądarek: Chrome (Desktop/Android), Firefox (Desktop), Safari (Desktop/iOS).
- Produkcyjny test Stripe: wymagany (kontrolowany, minimalna kwota, pełny refund, redacted evidence).
- Publiczny start wymaga osobnego certyfikatu X7.

### IMPLEMENTATION REQUIRED
- Full PL/EN translation for all launch-critical areas.

## O. Przegląd prawny

### OWNER DECISION
- Przed startem wymagany profesjonalny przegląd: modelu napiwek -> Patron Zone, checkoutu, zwrotów, regulaminu, prywatności, cookies, content notifications, moderacji, identyfikacji.
- Brak zakończonego przeglądu blokuje X7.
- Publiczne PL/EN legal copy musi zostać napisane i zatwierdzone.

### LEGAL REVIEW REQUIRED
- Comprehensive legal review of all product aspects and documents.
