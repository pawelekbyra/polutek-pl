# Serwerek 06: dostawcy maili transakcyjnych, ceny i limity (stan 2026-10-02)

Badanie z 2026-10-02. Pytanie: ile kosztuje wysyłka maili dla małego serwisu wideo (głównie maile konta: weryfikacja, reset hasła, powitanie, plus okazjonalne broadcasty) przy 1k-500k maili/mies., czy zostać przy Resend, i co by kosztowała zmiana. Uzupełnia [`05-sovereign-stack.md`](05-sovereign-stack.md) (tam: "wysyłka przez zewnętrzny relay, nie własny MTA").

Oznaczenia: **[V]** = liczba odczytana ze strony oficjalnej (WebFetch, 2026-10-02; narzędzie streszcza stronę automatycznie, więc przy decyzji warto rzucić okiem na stronę). **[W]** = źródło wtórne (porównywarki, blogi), niezweryfikowane na stronie producenta. **[?]** = nie udało się ustalić. Żaden numer nie pochodzi z pamięci bez oznaczenia.

> ## Rekomendacja dla nas
>
> 1. **Zostać na Resend.** Kod jest do niego dopasowany (SDK, webhook Svix, skrzynka przychodząca `email.received`), a wolumen jest mały. Koszt: **$0 do 3000 maili/mies. i max 100/dzień, $20/mies. do 50k, $35 do 100k** (Resend pricing [V]).
> 2. **Dzienny limit 100 maili to realne ograniczenie planu Free**, nie miesięczny. Przy ok. 2 mailach na rejestrację Free uciągnie **ok. 50 rejestracji dziennie** (zapas na resety haseł i broadcasty jest wtedy zerowy). Wystarczy jedna premiera z falą rejestracji, żeby mail weryfikacyjny zaczął odbijać się o limit.
> 3. **Wyzwalacze:** przejść na **Resend Pro ($20)** zanim wejdzie premiera/kampania albo gdy 7-dniowa średnia przekroczy **ok. 60 maili/dzień** (zapas 40%) albo 2400/mies. Rozważyć **SES** dopiero powyżej **ok. 150-200k maili/mies.** (Resend Scale 200k = $160 [W] vs SES ok. $20; zysk $140/mies. wart 1-2 dni migracji) albo gdy potrzebna jest **rezydencja danych w UE** (Resend trzyma dane w USA [V]). Poniżej 100k różnica to najwyżej $25/mies.; migracja się nie zwraca.
> 4. **Najtańsza alternatywa, gdyby Resend przestał pasować:** **Amazon SES** ($0,10/1000 w taryfie à la carte [V]; 100k maili = $10). Najlepsza darmowa alternatywa dla małego wolumenu: **Brevo Free 300/dzień** (ok. 150 rejestracji/dzień, [W]) albo Mailjet Free 6000/mies. i 200/dzień [V].
> 5. **Własny serwer pocztowy na Hetznerze: nie.** Porty 25 i 465 są blokowane, odblokowanie dopiero po miesiącu i zapłaconej pierwszej fakturze, decyzja uznaniowa [V]; do tego świeże IP bez reputacji. Zostaje relay przez port 587.
> 6. **Do zrobienia niezależnie od dostawcy:** do broadcastów dodać nagłówek `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (dziś wysyłamy tylko `List-Unsubscribe`), wymóg Gmaila/Yahoo przy masowej wysyłce (§5).

---

## 1. Ceny i limity dostawców

Wszystkie ceny w USD, miesięcznie, chyba że zaznaczono inaczej.

| Dostawca | Free | Płatne (start) | Nadwyżka / 1000 | Dedykowane IP | Źródło (data) |
|---|---|---|---|---|---|
| **Resend** | 3000/mies., **100/dzień**, 3 domeny, retencja 30 dni, inbound w cenie [V] | **Pro $20 = 50k**, **$35 = 100k**, brak limitu dziennego, 10 domen (+$20 za 100 domen), 5 endpointów webhook [V]. **Scale $90 = 100k**, [W]: $160 = 200k, $350 = 500k, $650 = 1M; 1000 domen, 10 webhooków [V] | Pro $0,90 [V]; Scale $0,90 do $0,46 [V] ($0,80 przy 200k, $0,70 przy 500k [W]) | **$30/mies., wymaga 3000+ maili dziennie, tylko Scale** [V]; w Enterprise w cenie | https://resend.com/pricing, https://resend.com/docs/knowledge-base/account-quotas-and-limits (2026-10-02); Scale 200k/500k: https://coldletter.com/blog/resend-pricing/ [W] |
| **Amazon SES** | brak stałego; nowi klienci do $200 kredytów AWS na 6 mies. [V]. Sandbox: 200 maili/24h, 1/s, tylko zweryfikowani odbiorcy [V] | à la carte **$0,10/1000** [V]. Nowe plany (strona z 2026-10-02): Essentials $0,16, Pro $0,22 + $105/mies., Enterprise $0,23 + $500/mies. za 1000 (do 10M) [V] | n/d (płatność za sztukę) | **Standard $24,95/mies./IP; Managed $15/mies. + opłata za mail** [V]. Virtual Deliverability Manager: $0,07-0,02 za mail [V] | https://aws.amazon.com/ses/pricing/ (2026-10-02) |
| **Brevo** | **300/dzień**, 100k kontaktów, API/SMTP w cenie [W] | Starter **$9 = 5k, $18 = 20k, $29 = 40k, $69 = 100k** [W]; Professional od $499 [W]; paczki prepaid $32 = 5k ... $1600 = 1M [W] | [?] | **$251/rok** [W] | https://www.emailtooltester.com/en/reviews/brevo/pricing/ [W]; strona brevo.com/pricing nie dała się odczytać automatem (2026-10-02) |
| **Postmark** | 100 maili/mies. [V] | Basic **$15 = 10k**, Pro $16,50 = 10k, Platform $18 = 10k [V]; wyższe progi (50k, 100k...) [?] na stronie nie wyświetlone | Basic $1,80, Pro $1,30, Platform $1,20 [V] | **od $50/mies./IP, wymaga 300k maili/mies., tylko Pro+** [V] | https://postmarkapp.com/pricing (2026-10-02) |
| **Mailgun** | **100/dzień**, retencja logów 1 dzień, 1 domena [V] | Basic od $15 = 10k; **Foundation $35 = 50k**; **Scale $90 = 100k** [V] | Foundation $1,30; Scale $1,10 [V] | **$59/mies./IP** (jedno w cenie Foundation i Scale) [V]; region UE jest [V] | https://www.mailgun.com/pricing/ (2026-10-02) |
| **SendGrid (Twilio)** | **brak stałego Free** (wygaszony 2025); 60 dni próby, 100/dzień [V][W] | **Essentials od $19,95 = 50k**, $34,95 = 100k [W]; Pro od $89,95 [V] | [?] | Pro w cenie, kolejne dokupowane [V]; rezydencja UE w Pro/Premier [V] | https://www.twilio.com/en-us/products/email-api/pricing (2026-10-02); 100k: https://dreamlit.ai/blog/resend-vs-sendgrid-vs-dreamlit [W] |
| **MailerSend** | 500/mies., 100 zapytań API/dzień, 1 domena, wymagana karta [V] | Hobby **$5,60 = 5k**; Starter 50k (cena nie wyświetlona [?]); Professional 50k (cena [?]) [V] | Hobby $1,50; Starter/Pro $0,90 [V] | dla dużych nadawców, cena na zapytanie [V] | https://www.mailersend.com/pricing (2026-10-02) |
| **Mailjet** | **6000/mies., 200/dzień** [V] | Starter **$9 = 8k**; Essential $19 = 15k; Premium $29 = 15k [V]; wyższe progi [?] | [?] (nadwyżka istnieje [V]) | 1 IP przy planach 100k+ na zapytanie (Premium) [V] | https://www.mailjet.com/pricing/ (2026-10-02) |

Uwaga o SES: strona pokazuje obecnie dwa modele naraz (stara taryfa à la carte $0,10 i nowe plany Essentials/Pro/Enterprise). Nie ustaliłem, który jest domyślny dla nowego konta; poniżej liczę oba.

## 2. Koszt miesięczny przy danym wolumenie

Założenia: wolumen = wszystkie maile; ok. 2 maile na nową rejestrację (weryfikacja + powitanie), reszta to resety haseł i broadcasty. Brak dedykowanego IP, brak VAT. Dla planów z wieloma progami liczę najtańszy plan, który pokrywa wolumen; nadwyżkę liczę wg stawek z §1. "~" = wyliczenie z nadwyżki, rzeczywisty (zwykle niższy) próg na stronie nieznany.

| Maili/mies. (rejestracji) | Resend | SES à la carte | SES Essentials | Brevo | Postmark | Mailgun | SendGrid | MailerSend | Mailjet |
|---|---|---|---|---|---|---|---|---|---|
| **1k** (500) | **$0** | $0,10 | $0,16 | $0 | $15 (Free tylko 100) | $0 | $19,95 (po próbie) | $0 | $0 |
| **5k** (2,5k) | **$20** (Free ma 3000) | $0,50 | $0,80 | $0 (limit 300/dz.) [W] lub $9 | $15 | $15 | $19,95 | $5,60 | $0 (6000) |
| **20k** (10k) | **$20** | $2 | $3,20 | $18 | ~$29,50 (Pro 10k + 10x$1,30) | $35 | $19,95 | Starter 50k, cena [?] | [?] (Essential 15k $19 + nadwyżka) |
| **50k** (25k) | **$20** | $5 | $8 | ~$29-69 (40k $29, 100k $69) | ~$68,50 (Pro) | $35 | $19,95 | Starter, cena [?] | [?] |
| **100k** (50k) | **$35** | $10 | $16 | $69 | ~$126 (Platform + nadwyżka) | $90 | $34,95 | ~Starter + 50 x $0,90 | [?] |
| **500k** (250k) | **$350** (Scale) [W]; na Pro byłoby ok. $395 | $50 | $80 | [?] (powyżej Starter 100k; Professional od $499) | ~$606 (Platform + nadwyżka) | ~$530 (Scale + 400 x $1,10) | [?] | [?] | [?] |

Do każdego SES dodać ewentualne $0,12/GB załączników [V] (u nas ich nie ma).

**Rejestracje dziennie, które mieści plan Free (2 maile/rejestrację, bez zapasu na resety):**

| Dostawca | Limit | Rejestracji dziennie | Uwagi |
|---|---|---|---|
| Resend Free | 100/dzień i 3000/mies. | **ok. 50** (miesięcznie 1500) | limit dzienny jest twardy [V] |
| Brevo Free | 300/dzień | **ok. 150** (do 4500/mies.) [W] | najwięcej z darmowych |
| Mailjet Free | 200/dzień, 6000/mies. | **ok. 100** | [V] |
| Mailgun Free | 100/dzień | **ok. 50** | retencja logów tylko 1 dzień [V] |
| MailerSend Free | 500/mies. | ok. 8 (250/mies.) | [V] |
| Postmark Free | 100/mies. | ok. 1-2 | tylko test [V] |
| SendGrid | próba 60 dni, 100/dzień | ok. 50, potem płatny | [V][W] |
| SES sandbox | 200/24h, tylko zweryfikowani odbiorcy | nieużyteczne dla ludzi | po wyjściu z sandboxa limit startowy rośnie [?] |

## 3. Czego dokładnie używamy z Resend (sprawdzone w repo)

| Element | Gdzie | Wymaga od dostawcy |
|---|---|---|
| Wysyłka pojedyncza i test | `lib/modules/email/infrastructure/legacy-email-service-provider.ts`: `resend.emails.send({ from, to, subject, html, replyTo, headers })` (3 wywołania: transakcyjny, broadcast per odbiorca, test) | API/SMTP, własne nagłówki (`List-Unsubscribe`, `X-Broadcast-Id`, `X-Recipient-Id`), Reply-To |
| Broadcast | ta sama klasa, `sendBroadcast`: **własna pętla** po odbiorcach z bazy, paczki po 50, 1 s przerwy; **nie używamy Resend Broadcasts API ani batch API**. Zgody, wyciszenia i unsubscribe są w naszej bazie (`EmailPreference`, `Subscription`, `EmailPolicy.isSuppressed`) | zwykła wysyłka; nic więcej |
| ID maila | `BroadcastEmailRecipient.resendEmailId` (schema.prisma, indeks) i `InboundEmail.resendId` | stabilne ID wiadomości zwracane przy wysyłce, powiązane ze zdarzeniami webhooka |
| Webhook | `app/api/webhooks/resend/route.ts` (weryfikacja podpisu **Svix**: `svix-id/timestamp/signature`, sekret `RESEND_WEBHOOK_SECRET`) i `handle-resend-webhook.use-case.ts` (idempotencja po `svix-id`) | zdarzenia `email.sent`, `delivered`, `delivery_delayed`, `bounced`, `complained`, `opened`, `clicked`, `unsubscribed`, `received`; pole `data.email_id`, `data.to[0]`; bounce/complaint zasila `EmailSuppression` |
| Skrzynka przychodząca | `email.received` zapisuje wiersz do `InboundEmail`, widok w `/admin/emails` | odbiór maili na domenie dostawcy + webhook. **Uwaga:** od 2026-10-01 skrzynka `hello@` jest w Google Workspace (MX u Google), więc ta funkcja Resend jest w praktyce niewykorzystywana |
| Audiences | `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts`: `contacts.get/create/update` z `RESEND_AUDIENCE_ID`; wywoływane przy subskrypcji i wypisaniu; gdy brak zmiennej zwraca `NOT_CONFIGURED` i nic się nie dzieje | to tylko lustro; źródłem prawdy jest nasza baza. Można wyłączyć bez skutku dla działania |
| Testy / granice | `tests/unit/modules/email/email-boundary.test.ts` pilnuje, że `new Resend` jest tylko w dwóch plikach infrastruktury | migracja dotyka dokładnie tych plików |

## 4. Nakład na migrację z Resend

Sumarycznie: **ok. 1-2 dni pracy** na SES, **ok. 0,5-1 dnia** na dostawcę z SMTP/API w podobnym stylu (Postmark, Mailgun, Brevo). Kod jest już dobrze odgrodzony (interfejs `EmailProvider`).

1. **Wysyłka (łatwe):** podmienić `emails.send` w jednym pliku (3 miejsca) na SDK dostawcy albo na `nodemailer` po SMTP (port 587). Zwracane ID trzeba zmapować na `resendEmailId` (kolumna działa jako ogólne "provider message id"; nazwa myląca, ale zmiana nazwy nie jest konieczna).
2. **Webhook (średnie, główna praca):** każdy dostawca ma inny format i podpis. SES wysyła zdarzenia przez konfigurację zestawu (Configuration Set) do SNS i dalej HTTPS: potrzebny odbiornik z weryfikacją podpisu SNS i potwierdzeniem subskrypcji, mapowanie `Delivery/Bounce/Complaint/Open/Click` na nasze statusy. Postmark/Mailgun/Brevo mają prostsze webhooki z podpisem HMAC. Idempotencja po `svix-id` trzeba zastąpić ID zdarzenia dostawcy.
3. **Otwarcia i kliknięcia:** SES wymaga włączenia śledzenia w zestawie konfiguracji, inaczej `opened/clicked` znikną (nie krytyczne dla konta).
4. **Skrzynka przychodząca:** nie przenosimy (Gmail/Workspace). Usunąć gałąź `email.received` albo zostawić jako martwą.
5. **Audiences:** wyrzucić `ResendAudienceGateway` albo zostawić bez `RESEND_AUDIENCE_ID`. Zero wpływu na bazę.
6. **DNS:** nowy SPF/DKIM/DMARC dla domeny nadawczej (`pawelperfect.com`), przejście okresu rozgrzewania nowego dostawcy. Okres równoległy: dwa dostawcy w SPF, dopóki Resend nie jest wyłączony.
7. **SES specyficznie:** wyjście z sandboxa (formularz, odpowiedź zwykle w 24 h [V: docs.aws.amazon.com/ses/latest/dg/request-production-access.html]), weryfikacja domeny przed wnioskiem przyspiesza zgodę, kwoty/limity per region, własna obsługa listy wyciszeń (mamy `EmailSuppression`, więc OK). Region UE (np. Irlandia) wybrać świadomie [region nieweryfikowany co do dostępności odbioru, nie dotyczy nas].
8. **Testy:** `legacy-email-service-provider` i `resend-audience.gateway` mają testy jednostkowe, do przepisania razem z kodem.

## 5. Dostarczalność, RODO, wymogi

- **Współdzielone IP vs dedykowane.** Na małym wolumenie (poniżej ok. 100k/mies.) współdzielone IP dostawcy jest zwykle lepsze: reputacja już zbudowana, a dedykowane IP trzeba rozgrzewać i wysyłać regularnie. Dedykowane IP ma sens od ok. 100-300k/mies. (progi dostawców: Resend 3000/dzień [V], Postmark 300k/mies. [V]). Ryzyko wspólnego IP: sąsiedzi; dlatego maile konta (reset hasła) warto wysyłać z subdomeny osobnej od broadcastów.
- **RODO i DPA.** Resend: DPA wstępnie podpisane, dostępne po rejestracji (Settings, Documents); transfery oparte na SCC i EU-US Data Privacy Framework; SOC 2 Type II [V: https://resend.com/security, 2026-10-02]. **Dane (metadane, logi, API) Resend trzyma w USA niezależnie od regionu wysyłki; wysyłać można z Irlandii (eu-west-1) lub São Paulo** [V: https://resend.com/docs/dashboard/domains/regions, 2026-10-02]. SES, Mailgun (region UE [V]) i SendGrid Pro (rezydencja UE [V]) pozwalają na dane w UE; Brevo i Mailjet to firmy francuskie [W, nie sprawdzono na stronach dostawców]. Jeśli rezydencja danych w UE jest wymogiem (do ustalenia z właścicielem/prawnikiem), Resend jej nie spełnia.
- **Wymagania nadawcy w UE/PL.** Do maili transakcyjnych (konto, reset) nie trzeba zgody marketingowej; do broadcastów tak (u nas: opt-in w `Subscription` + `EmailPreference`, kontrola w `sendBroadcast`). Podstawa: RODO oraz polska ustawa o świadczeniu usług drogą elektroniczną i prawo komunikacji elektronicznej (zgoda na informacje handlowe). To uwaga ogólna, nie porada prawna **[niezweryfikowane]**.
- **Gmail/Yahoo (od lutego 2024).** Dla nadawców powyżej 5000 maili dziennie do Gmaila: mocne uwierzytelnienie, **jednoklikowe wypisanie, obsługa w 2 dni** i próg spamu [V: https://blog.google/products/gmail/gmail-security-authentication-spam-protection/, 2026-10-02; sama strona nie podaje liczby; powszechnie cytowany próg to 0,3%, [?]]. Dla mniejszych nadawców SPF + DKIM + DMARC i tak są praktycznie warunkiem trafienia do skrzynki. Resend wymaga od konta bounce poniżej 4% i spam poniżej 0,08% [V: account-quotas-and-limits]. U nas: SPF/DKIM są z weryfikacji domeny w Resend; **DMARC trzeba mieć w DNS Cloudflare (sprawdzić `_dmarc`)**; do broadcastów dodać `List-Unsubscribe-Post`.
- **Własny serwer pocztowy.** Hetzner blokuje porty 25 i 465 na serwerach cloud; odblokowanie dopiero po miesiącu współpracy i zapłaconej pierwszej fakturze, "case by case"; port 587 do zewnętrznego relaya jest otwarty [V: https://docs.hetzner.com/cloud/servers/faq/, 2026-10-02]. Dodatkowo: świeże IP bez reputacji (rozgrzewanie tygodniami), listy blokujące, rDNS/PTR, utrzymanie DKIM i monitoringu odbić, odpowiedzialność za spam z naszego IP. Koszt pieniężny niski (serwer już jest), koszt operacyjny i ryzyko dostarczalności wysokie: **odradzam**, zgodnie z `05-sovereign-stack.md`.

## 6. Pytania otwarte

1. Czy właściciel wymaga **rezydencji danych w UE**? Jeśli tak, Resend odpada; kandydat: SES (Irlandia/Frankfurt) lub Mailgun EU.
2. Czy SES domyślnie rozlicza à la carte ($0,10) czy w nowych planach (Essentials $0,16)? Do sprawdzenia w konsoli przy zakładaniu konta.
3. Ceny Resend Scale (200k = $160, 500k = $350) pochodzą ze źródła wtórnego; strona producenta pokazała tylko widełki $90-$1150. Potwierdzić przed decyzją o Scale.
4. Brevo: strona producenta nie dała się odczytać automatem, ceny ze źródła wtórnego; progi 50k i 500k nieznane.
5. SendGrid, Mailjet, MailerSend, Postmark: brakujące progi wolumenowe (oznaczone [?]); nie badałem dalej, bo nie są kandydatami.
6. Czy `_dmarc` jest już ustawiony dla `pawelperfect.com` (i `.pl`)? Jaką ma politykę (none/quarantine)?
7. Czy broadcasty mają iść z innej subdomeny niż maile konta (np. `news.pawelperfect.com`)?
8. Po wyjściu SES z sandboxa: jaki dzienny limit startowy przydziela AWS [?].

## 7. Źródła (odczyt 2026-10-02)

- Resend: https://resend.com/pricing, https://resend.com/docs/knowledge-base/account-quotas-and-limits, https://resend.com/docs/dashboard/domains/regions, https://resend.com/security
- Resend Scale 200k/500k [W]: https://coldletter.com/blog/resend-pricing/
- Amazon SES: https://aws.amazon.com/ses/pricing/, https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- Postmark: https://postmarkapp.com/pricing
- Mailgun: https://www.mailgun.com/pricing/
- SendGrid: https://www.twilio.com/en-us/products/email-api/pricing; [W] https://dreamlit.ai/blog/resend-vs-sendgrid-vs-dreamlit
- MailerSend: https://www.mailersend.com/pricing
- Mailjet: https://www.mailjet.com/pricing/
- Brevo [W]: https://www.emailtooltester.com/en/reviews/brevo/pricing/
- Gmail: https://blog.google/products/gmail/gmail-security-authentication-spam-protection/
- Hetzner: https://docs.hetzner.com/cloud/servers/faq/
- Repo: `lib/modules/email/infrastructure/legacy-email-service-provider.ts`, `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts`, `app/api/webhooks/resend/route.ts`, `lib/modules/email/application/handle-resend-webhook.use-case.ts`
