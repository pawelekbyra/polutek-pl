# Własna wysyłka e-mail (Mailcow + Listmonk): notatka właściciela i uwagi techniczne

Stan: **2026-10-03**. Notatka właściciela z 2026-10-02 (plan: własny serwer pocztowy zamiast Resend), poniżej wiernie, a po niej poprawki i warunki wstępne po sprawdzeniu z tym, co faktycznie mamy na serwerku. **To jest plan na później, nie zadanie do wykonania teraz**: Resend zostaje, dopóki wolumen jest mały (patrz `06-email-providers-pricing.md`).

## 1. Notatka właściciela (treść)

### Cel
Całkowita migracja z płatnego API dostawców zewnętrznych (np. Resend) na własną, niezależną strukturę serwerową. Maksymalna optymalizacja kosztów przy zachowaniu wysokiej dostarczalności wiadomości dzięki rygorystycznej konfiguracji systemowej i DNS.

### Stan infrastruktury (właściciel)
- Hetzner Cloud, Norymberga, serwer CPX22, adres IP serwera `46.224.211.115`.
- Reputacja IP (2026-10-02): czysty na 58 z 60 list RBL (Spamhaus ZEN: OK). Dwie blokady do usunięcia: `RATS NoPtr` (brak rDNS) i `BARRACUDA` (odziedziczona po poprzednim użytkowniku adresu).

### Kroki
1. **Odblokowanie portów w Hetzner.** Domyślnie zablokowane są wyjściowe porty 25 i 465. Zgłoszenie w Cloud Console z prośbą o odblokowanie portu 25 (legalne maile transakcyjne i newsletter w opt-in); Hetzner zwykle odblokowuje po opłaceniu pierwszej faktury (właściciel: ok. miesiąc).
2. **Reverse DNS (PTR)** dla IPv4 i IPv6 na pełną nazwę serwera pocztowego (np. `mail.<domena>`).
3. **Delisting z Barracudy** po ustawieniu rDNS (Barracuda Central, formularz dla IP serwera).
4. **Mailcow (Dockerized)**: `./generate_config.sh`, `MAILCOW_HOSTNAME=mail.<domena>`; Mailcow sam zarządza certyfikatami Let's Encrypt i kluczami DKIM.
5. **DNS:** rekord A `mail.<domena>` na IP serwera, MX `10 mail.<domena>.`, SPF `v=spf1 ip4:<IP> -all`, DKIM wygenerowany przez Mailcow, DMARC na start `p=none; pct=100`, po potwierdzeniu poprawnego przechodzenia zaostrzyć do `quarantine`/`reject`.
6. **Listmonk** (open source) do wysyłki, bazy subskrybentów i szablonów, przez wewnętrzne SMTP Mailcowa; ścisłe kolejkowanie (np. 5-10 maili/s), **rozgrzewanie IP** (warm-up) stopniowo, od małych paczek do zaufanych adresów.

### Podsumowanie (właściciel)
Przy kilkudziesięciu do kilkuset tysięcy maili miesięcznie koszt spadałby z poziomu kilkudziesięciu dolarów (Resend) do stałego kosztu serwera.

## 2. Poprawki i warunki wstępne (agent, po sprawdzeniu)

- **Sprzęt:** CPX22 ma **2 vCPU** (nie 3), 4 GB RAM, 80 GB. Dziś ten serwer już utrzymuje aplikację, Postgresa, Redisa, PP Support i kodowanie wideo (ok. 2/3 pamięci zajęte). Mailcow (Postfix, Dovecot, Rspamd, ClamAV, SOGo, MariaDB) zaleca ok. 6 GB RAM samodzielnie; ClamAV można wyłączyć, ale i tak **nie zmieści się** obok reszty. Wniosek: potrzebny **osobny serwer** ("ops"/mail).
- **Koszt:** "ok. 5-6 € miesięcznie" nie dotyczy nas. Ceny Hetznera wzrosły dwukrotnie w 2026 (kwiecień, czerwiec); nowy serwer o takich parametrach to ok. 15-20 € netto miesięcznie (do sprawdzenia w konsoli w dniu zamawiania). Stała oszczędność względem Resend ($20 do 50 tys. maili miesięcznie) pojawia się dopiero przy wolumenie rzędu setek tysięcy maili.
- **Poczta przychodząca jest osobnym tematem od wysyłki.** Dziś przychodzącą obsługuje Cloudflare Email Routing -> PP Support (`docs/operations/SUPPORT-CENTER.md`); Mailcow nie jest do tego potrzebny, a zmiana MX na własny serwer tworzy pojedynczy punkt awarii odbioru. Zalecenie: odbiór zostaje w Cloudflare, własny serwer służy wyłącznie do wysyłki.
- **Dostarczalność:** nowy adres IP i nowa domena to zimny start; Hotmail/Outlook traktują ich najsurowiej. Rozgrzewanie trwa tygodnie (od kilkudziesięciu do kilku tysięcy maili dziennie). W tym czasie wysyłka krytyczna (potwierdzenia konta, reset hasła) musi iść dalej przez Resend. Wniosek: Resend zostaje jako zapas także po wdrożeniu własnego serwera (przełącznik w konfiguracji).
- **Rekordy DNS:** SPF z `-all` tylko dla własnego IP przestaje wpuszczać Resend; podczas przejścia SPF musi zawierać oba źródła (`include:` Resend + `ip4:`), DKIM obu. DMARC zaostrzamy dopiero po tygodniach czystych raportów (`rua` kieruje na skrzynkę raportów, nie na skrzynkę wsparcia).
- **Port 25/rDNS:** ustawienie PTR jest możliwe od ręki (Cloud Console, Networking); odblokowanie portu 25 wymaga zgłoszenia do wsparcia Hetznera i nie wiemy, jak długo potrwa. Do tego czasu własna wysyłka bezpośrednia jest niemożliwa; ruch może iść przez port 587 przez przekaźnik zewnętrzny, co jednak nie spełnia celu niezależności.

## 3. Proponowana kolejność (gdy temat wróci)

1. Zgłoszenie do Hetznera o port 25 (nic nie kosztuje, można zrobić od razu, żeby czas odblokowania płynął).
2. Decyzja o drugim serwerze ("ops", z workerem wideo, monitoringiem i pocztą); koszt do akceptacji właściciela.
3. rDNS, delisting, Mailcow lub lżejszy stos (sam Postfix + OpenDKIM + Rspamd) na drugim serwerze.
4. Rozgrzewanie z wysyłką nieważną (newsletter do zaufanych), Resend przy krytycznej.
5. Dopiero po tygodniach stabilnych wyników przełączenie maili transakcyjnych.
