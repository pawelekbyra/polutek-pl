# Badania z 2026-10-13: platforma wielu twórców

**Status: badania, nie decyzje.** Pięć niezależnych raportów powstało przy projektowaniu przejścia z jednego kanału na platformę wielu
twórców (każdy użytkownik zakłada kanał, wgrywa filmy, sprzedaje dostęp). Decyzje i stan prac: [`../../architecture/multi-creator-platform.md`](../../architecture/multi-creator-platform.md).
Każdy raport oddziela fakty ze źródeł od wniosków i wymienia luki; nie jest poradą prawną ani podatkową.

| Plik | Odpowiada na pytanie |
|---|---|
| [`inwentaryzacja-kodu-wielokanalowosc.md`](inwentaryzacja-kodu-wielokanalowosc.md) | Gdzie dokładnie kod zakłada jeden kanał i „admin = twórca”; schemat docelowy; kolejność etapów |
| [`ux-studio-tworcy.md`](ux-studio-tworcy.md) | Jak wygląda zakładanie kanału, upload, zarządzanie, moderacja, wypłaty u YouTube, PeerTube, Twitcha, Patreona; projekt Studia |
| [`inzynieria-tresci-uzytkownikow.md`](inzynieria-tresci-uzytkownikow.md) | Uprawnienia, upload od obcych, izolacja ffmpeg, CSAM, uchwyty, kolejka, skalowanie |
| [`prawo-platforma-wielu-tworcow.md`](prawo-platforma-wielu-tworcow.md) | DSA, KRRiT (platformy wideo), prawo autorskie, TCO, CSAM, usługi płatnicze, VAT, DAC7, małoletni, RODO, regulaminy |
| [`stripe-connect-tworcy.md`](stripe-connect-tworcy.md) | Stripe Connect: kto jest sprzedawcą (MoR), typy obciążeń, opłaty, KYC, osadzone komponenty |

## Uwagi do czytania

- Raport o Stripe Connect powstał przy założeniu **napiwków** (twórca jako sprzedawca). Właściciel zdecydował 2026-10-13 o **sprzedaży dostępu z platformą jako
  sprzedawcą**; wnioski o VAT, DAC7 i opłatach Connect trzeba czytać z tą poprawką (patrz `multi-creator-platform.md`, „Pieniądze”).
- Raport prawny: teksty wyroku Tolsma i części artykułów DSA/TCO nie zostały pobrane, są oznaczone jako luki.
- Raport o inwentaryzacji dotyczy stanu `main` 376e3517.
