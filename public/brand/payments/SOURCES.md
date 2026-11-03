# Logotypy metod platnosci w kasie (strefa patrona)

Uzywane wylacznie do wskazania, ze dana metode platnosci mozna wybrac w kasie (Stripe). Nie przekolorowywac, nie obracac,
nie zmieniac proporcji (uzywamy tylko `height`, szerokosc wynika z proporcji). Pola ochronne: logotypy sa pelnymi plakietkami
(zaokraglony prostokat), wiec pole ochronne zapewnia odstep miedzy nimi (>= 8 px) w `PassTrustRow`.

| Plik | Zrodlo | Licencja / zasady |
| --- | --- | --- |
| `visa.svg` | pakiet npm `payment-icons` 1.2.1 (Stuart Colville), `min/flat/visa.svg`, zoptymalizowany svgo, dodany `viewBox` | Grafika: MPL-2.0 (`LICENSE-payment-icons-MPL-2.0.txt`). Znak Visa jest znakiem towarowym Visa Inc.; uzycie przez akceptanta do informacji, ze przyjmuje karty Visa, zgodnie z Visa Product Brand Standards (https://brand.visa.com). |
| `mastercard.svg` | `payment-icons` 1.2.1, `min/flat/mastercard.svg`, svgo, `viewBox` | Grafika: MPL-2.0. Znak Mastercard jest znakiem towarowym Mastercard International; uzycie do oznaczenia akceptacji kart, zgodnie z Mastercard Brand Center (https://www.mastercard.com/brandcenter). |
| `blik.svg` | oficjalna strona BLIK, `https://blik.com/images/content/18/blik-logo_5f76d581b69976_89158967.svg` (stopka blik.com, pobrane 2026-11-03), svgo, `viewBox` | Znak towarowy Polskiego Standardu Platnosci sp. z o.o. Brand book BLIK (kopia: https://simpay.pl/uploads/download/graphics/blik_branding_en.pdf): logotyp w oryginalnych kolorach, z polem ochronnym, bez zmian. Akceptanci BLIK (tu: przez Stripe) moga uzywac logotypu do oznaczenia metody platnosci. |

Uwaga: pliki `visa.svg` i `mastercard.svg` pochodza z biblioteki spoza oficjalnych brand center (licencja MPL-2.0 dotyczy grafiki, nie
znakow). Przed uruchomieniem platnosci live warto podmienic je na pliki z Visa/Mastercard brand center, jesli wymaga tego umowa z operatorem.
Alternatywa o czystej licencji: `simple-icons` (CC0) - tylko jednokolorowe glify, bez BLIK.
