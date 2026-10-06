# Dostarczalność maili z aplikacji (stan 2026-10-02)

> **Aktualizacja (SES):** wysyłka aplikacji przeszła z Resend na Amazon SES (SMTP, eu-north-1; [`EMAIL_SES.md`](EMAIL_SES.md)); Resend usunięty z kodu. Opis poniżej (nagłówki Authentication-Results, selektor `resend`, rekordy `send.`) jest **historyczny** z czasów Resend: obecnie DKIM to trzy rekordy SES, MAIL FROM to `bounce.pawelperfect.com`. Rekomendacja „zostać na Resend” w sekcji o dedykowanym IP jest nieaktualna (decyzja właściciela: SES). Konto SES startuje w **sandboxie** (tylko zweryfikowani odbiorcy), a odbicia i skargi trafiają do `EmailSuppression` przez SNS (`/api/webhooks/ses`).

Bez sekretów. Dotyczy maili automatycznych (weryfikacja konta, reset hasła, powitanie, potwierdzenia napiwków) wysyłanych przez Resend z `Pawel Perfect <no-reply@pawelperfect.com>`. Skrzynka `hello@` (Google Workspace) i jej konfiguracja: [`EMAIL_SETUP.md`](EMAIL_SETUP.md). Ceny i alternatywy dostawców: [`../research/serwerek/06-email-providers-pricing.md`](../research/serwerek/06-email-providers-pricing.md).

## 1. Incydent

2026-10-02 mail weryfikacyjny trafił do **Spamu** na adresie hotmail.com, a wcześniejsze testy na Gmaila zawsze lądowały w skrzynce odbiorczej. Resend raportował status `delivered`, czyli Microsoft przyjął wiadomość i dopiero potem wrzucił ją do Junk. To decyzja filtra reputacji/treści, nie błąd techniczny.

## 2. Co sprawdziliśmy (audyt)

**Uwierzytelnienie jest w porządku.** Nagłówki prawdziwego maila z aplikacji, odebranego w skrzynce Google (`hello@`, 2026-10-02, tokeny usunięte):

```
Authentication-Results: mx.google.com;
  dkim=pass header.i=@pawelperfect.com header.s=resend;
  dkim=pass header.i=@amazonses.com header.s=shh3fegwg5fppqsuzphvschd53n6ihuv;
  spf=pass (google.com: domain of 0102...@send.pawelperfect.com designates 54.240.x.x as permitted sender)
      smtp.mailfrom=0102...@send.pawelperfect.com;
  dmarc=pass (p=NONE sp=NONE dis=NONE)
```

Czyli SPF (przez `send.pawelperfect.com`), DKIM własny (`d=pawelperfect.com`, selektor `resend`) i DMARC przechodzą z dopasowaniem (alignment). Śledzenie otwarć i kliknięć jest w Resend wyłączone dla `pawelperfect.com` (`Open Tracking: false`, `Click Tracking: false`), więc linki nie są owijane w cudze domeny. Mail weryfikacyjny nie miał `List-Unsubscribe` (dobrze); powitalny miał (to dopuszczalne).

**Przyczyny w naszych rękach (naprawione w PR z tym dokumentem):**

| Problem | Dlaczego szkodzi | Poprawka |
|---|---|---|
| Nazwa nadawcy `PAWELPERFECT.COM` (wielkie litery, wygląda jak domena) | klasyczny sygnał spamu/phishingu | `Pawel Perfect` (`EMAIL_SENDER_NAME`) |
| W temacie `www.pawelperfect.com`, wykrzykniki, pseudonim użytkownika (`Welcome to …, dupa!`), emoji | adres www i dowolny nick w temacie podbijają punktację spamową | tematy krótkie, zwykłą pisownią, bez domeny, nicku i emoji (`{{brandName}}`) |
| HTML był samym `<div>` bez `<!DOCTYPE>`, `<html>`, `<title>`, `lang` | niepełny dokument wygląda na maila z szablonu spamerskiego | pełny dokument (`wrapEmailDocument`) |
| Brak własnej części tekstowej (Resend generował ją sam) | multipart text+HTML to podstawa; autogenerowany tekst zawierał śmieci | własne `text` z widocznym adresem linku (`htmlToPlainText`) |
| Nagłówek i przycisk WIELKIMI LITERAMI (`text-transform: uppercase`) | shouty | usunięte z szablonów domyślnych |
| Brak pre-headera | pusty/losowy podgląd w skrzynce | ukryty pre-header z pierwszego akapitu |
| Brak stopki z tożsamością | mail bez fizycznego nadawcy | linia `Paweł Perfect · ul. Złota 75, 00-819 Warszawa · hello@…` pod każdą wiadomością (ta sama osoba i adres co w Regulaminie) |
| Brak `Auto-Submitted`, brak unikalnego ID | autorespondery mogą odpowiadać, kolejne maile łączą się w wątki | `Auto-Submitted: auto-generated`, `X-Entity-Ref-ID: <uuid>` |

Zostawione bez zmian (celowo): `Reply-To: support@pawelperfect.com` (alias skrzynki, przekazywany do PP Support), link weryfikacyjny na `www.pawelperfect.com` (ta sama domena co nadawca, tekst linku nie udaje innego adresu), brak obrazków w mailach (stosunek tekst/HTML jest zdrowy).

**Uwaga o szablonach z bazy.** Szablon zapisany w `/admin/emails` ma pierwszeństwo przed domyślnym. Jeśli ktoś kiedyś zapisał `verify-email`, `reset-password`, `password-changed` lub `welcome-email`, jego stary temat/treść nadal pójdzie w świat. Sprawdź w `/admin/emails` i usuń zapisane wersje (wróci domyślna) albo przepisz ręcznie. Nowa zmienna `{{brandName}}` jest dostępna w edytorze.

## 3. Dlaczego nowa domena ląduje w spamie Hotmaila

Poprawne SPF/DKIM/DMARC to warunek konieczny, a nie dostateczny. Microsoft (Outlook.com/Hotmail/Live) ocenia głównie **reputację**: wiek domeny, historię wysyłki, reakcje odbiorców (czy wyciągają z Junk, odpowiadają, klikają), oraz reputację adresu IP. U nas:

- domena `pawelperfect.com` ma kilka dni i prawie żadnej historii wysyłki,
- wysyłamy ze **współdzielonych IP Amazon SES** (przez Resend); część sąsiadów to zły ruch, a Microsoft jest wobec nowych domen na takich IP najostrzejszy,
- pierwsza wiadomość do danego odbiorcy z nieznanego nadawcy jest najbardziej podejrzana,
- Gmail wcześniej puszczał, bo pozwala sobie na większe zaufanie do poprawnego DKIM/DMARC; Microsoft nie.

To zjawisko **mija z czasem i wolumenem**, nie da się go "naprawić jednym ustawieniem".

## 4. Zmiany w DNS (Cloudflare, strefa `pawelperfect.com`, 2026-10-02)

| Rekord | Przed | Po |
|---|---|---|
| `TXT _dmarc.pawelperfect.com` | `v=DMARC1; p=none;` | `v=DMARC1; p=none; rua=mailto:hello@pawelperfect.com; fo=1` |

Cofnięcie: ustaw z powrotem starą wartość (ID rekordu `41c413018924265fa9f08cabfde76865`). Tryb `p=none` zostaje, dopóki nie zobaczymy kilku tygodni czystych raportów; wtedy `p=quarantine; pct=25`, potem 100, na końcu ewentualnie `reject`. Raporty zbiorcze (XML, codziennie od Google, Microsoftu i innych) będą przychodzić na `hello@`; można w Gmailu zrobić filtr "od `noreply-dmarc-support@google.com` / temat `Report domain`" do etykiety.

Sprawdzone, bez zmian:
- **SPF** `pawelperfect.com` = `v=spf1 include:_spf.google.com ~all` (Google: ok. 4 zapytania DNS) oraz osobny SPF `send.pawelperfect.com` = `include:amazonses.com` (Resend). Dwa rekordy dotyczą dwóch różnych nazw, więc nie sumują zapytań; limit 10 jest daleko. Resend nie potrzebuje wpisu w SPF głównej domeny (DMARC przechodzi przez DKIM).
- **MTA-STS / TLS-RPT:** nie dodane. MTA-STS chroni *przychodzące* do nas maile (wymaga hostowania pliku polityki na `mta-sts.pawelperfect.com`) i nie wpływa na to, czy Hotmail wrzuci nasze maile do Junk. Zysk dla dostarczalności zerowy, koszt utrzymania niezerowy. Wrócić, jeśli kiedyś zależy nam na ochronie poczty przychodzącej.

## 5. Co musi zrobić właściciel

1. **Oznaczyć jako "Nie jest spamem".** Na koncie hotmail (to z incydentu) otworzyć wiadomość w Junk i kliknąć **Nie jest to wiadomość-śmieć / Not junk**, potem **Dodaj nadawcę do bezpiecznych** (Ustawienia, Poczta, Wiadomości-śmieci, Bezpieczni nadawcy: `pawelperfect.com`). Zrobić to samo na kilku własnych kontach Outlook/Hotmail/Live i poprosić pierwszych znajomych-testerów. Każde takie kliknięcie buduje reputację domeny u Microsoftu.
2. **Weryfikacja treści nową wersją.** Po wdrożeniu tego PR wysłać kilka prawdziwych rejestracji na konta Outlook (własne) i sprawdzić, czy trafia do Inbox. Wynik zapisać w tym pliku (sekcja 8).
3. **SNDS i JMRP (programy Microsoftu) wymagają własnego adresu IP**, bo rejestruje się je na zakres IP i potwierdza własność. Wysyłamy przez współdzielone IP Amazona, więc **teraz nie da się ich użyć**. Jeśli kiedyś będzie dedykowane IP (patrz sekcja 7): wejść na `https://sendersupport.olc.protection.outlook.com/snds/` (adres do potwierdzenia przy rejestracji), zalogować się kontem Microsoft, **Request Access**, wpisać zakres IP, potwierdzić mailem na adres kontaktowy właściciela zakresu; JMRP na tej samej stronie, zakładka **Junk Mail Reporting Program**, podać ten sam zakres i adres, na który mają przychodzić skargi (`hello@pawelperfect.com`).
4. **Formularz wsparcia nadawców Microsoftu** (o ile odmawiają dostarczenia, nie tylko Junk): `https://olcsupport.office.com/` (adres do potwierdzenia), opisać problem, podać domenę `pawelperfect.com`, adres IP z nagłówka `Received`/`X-SES-Outgoing` (z oryginału wiadomości) i wiadomość z Junk. Przy samym lądowaniu w Junk (bez blokady) formularz zwykle nie pomaga; sensownie dopiero po tygodniach.
5. **Google Postmaster Tools** (reputacja u Gmaila): `https://postmaster.google.com`, **Add domain** `pawelperfect.com`, zalogować się kontem Workspace; weryfikacja to rekord TXT w Cloudflare (agent doda go na życzenie). Dane pojawiają się dopiero przy kilkuset mailach dziennie do Gmaila, więc na razie będzie pusto.
6. **Nie wysyłać broadcastów do całej bazy** na świeżej domenie (rozgrzewanie, sekcja 6).

## 6. Rozgrzewanie i dobre praktyki

- Maile konta (weryfikacja, reset) wysyłamy tylko po akcji użytkownika, więc są "oczekiwane"; to najlepszy typ ruchu na starcie.
- Wolumen rośnie naturalnie z rejestracjami. Pierwszy **broadcast** dopiero po kilku tygodniach stabilnej wysyłki, do małej, zaangażowanej grupy (kilkadziesiąt osób), potem x2 co kilka dni, obserwując skargi i odbicia. Zero skoków z 0 do tysięcy.
- Broadcast osobno od maili konta: rozważyć subdomenę `news.pawelperfect.com` z osobnym kluczem DKIM, żeby zła reakcja na newsletter nie zepsuła reputacji maili weryfikacyjnych. W broadcastach dodać `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (dziś wysyłamy tylko link w treści; to wymóg Gmaila/Yahoo przy masowej wysyłce).
- Nie wysyłamy do adresów, które odbiły (twarde odbicie i skarga trafiają do `EmailSuppression` przez webhook Resend).
- Temat i treść: krótko, po ludzku, bez wielkich liter, wykrzykników, skracaczy linków i obrazków-zamiast-tekstu.

## 7. Dedykowane IP albo inny dostawca: czy warto

**Nie, na naszym wolumenie.** Dedykowane IP wymaga stałego, dużego ruchu, żeby zbudować reputację (rozgrzewanie tygodniami); przy kilkudziesięciu mailach dziennie IP jest "zimne" i wypada gorzej niż wspólna pula dużego dostawcy. Resend sprzedaje je dopiero od planu Scale i przy 3000+ maili dziennie, SES kosztuje ok. $24,95 za IP miesięcznie (dane i źródła: doc 06). Zmiana dostawcy na SES/Postmark/Mailgun nie naprawi problemu "nowa domena", bo ten bierze się z domeny i braku historii, nie z marki przewoźnika; migracja kosztuje 0,5-2 dni i zaczęlibyśmy reputację od zera także na IP. Wyjątek: Postmark kładzie nacisk na ruch transakcyjny i jest często chwalony za dostarczalność do Microsoftu, ale od $15/mies. za 10k maili i bez przewagi dla małej domeny w pierwszych tygodniach. Wnioski z doc 06 zostają: **zostać na Resend**, przejść na Pro ($20), gdy zbliżymy się do limitu 100 maili dziennie, dedykowane IP/SES rozważać dopiero przy ok. 100-200k maili miesięcznie.

## 8. Monitoring i checklista

Codziennie (kilka dni po zmianie, potem co tydzień):
- Panel Komunikacja (zdarzenia z SNS) i konsola SES (Reputation metrics). Cel: odbicia poniżej 4%, skargi poniżej 0,08% (limity Resend).
- Endpoint SNS `/api/webhooks/ses` zapisuje twarde odbicia i skargi do `EmailSuppression` (EMAIL_SES.md, sekcja 6).
- Raporty DMARC na `hello@` (XML od Google/Microsoft): szukać `fail` w `dkim`/`spf` i nieznanych źródeł (ktoś podszywa się pod domenę).
- Test ręczny: rejestracja na świeżych kontach Gmail, Outlook/Hotmail, Yahoo; sprawdzić folder i nagłówki (`Authentication-Results`).
- Narzędzie agenta do odczytu nagłówków z `hello@`: patrz `AGENT_ACCESS.md` (Gmail przez konto usługi).

Checklista przed większą wysyłką:
- [ ] `Authentication-Results`: `spf=pass`, `dkim=pass d=pawelperfect.com`, `dmarc=pass`
- [ ] Tematy bez domeny, nicku, wykrzykników, emoji; nazwa nadawcy zwykłą pisownią
- [ ] Multipart text+HTML, pełny dokument HTML, stopka z tożsamością
- [ ] Brak `List-Unsubscribe` w mailach bezpieczeństwa; w masowych: `List-Unsubscribe` + `-Post`
- [ ] Raporty DMARC czyste przez 2-4 tygodnie przed zaostrzeniem polityki
- [ ] Wolumen rośnie stopniowo, broadcasty osobno

Wyniki testów (uzupełniać):

| Data | Odbiorca | Folder | Uwagi |
|---|---|---|---|
| 2026-10-02 | hotmail.com (przed zmianą) | Spam | stary temat z domeną i nazwa nadawcy WIELKIMI |
| 2026-10-02 | Google Workspace `hello@` (po zmianie) | Inbox | `spf/dkim/dmarc=pass`, `Auto-Submitted`, `X-Entity-Ref-ID` obecne |
| | hotmail.com (po zmianie) | do sprawdzenia przez właściciela | |
