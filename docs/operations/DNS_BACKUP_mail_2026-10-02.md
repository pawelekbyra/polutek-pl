# Mail DNS before the Cloudflare Email Routing cutover (2026-10-02)

No secrets. Source of truth for rollback; full JSON snapshots are in `%USERPROFILE%\.ai-secrets\dns-backup\` (outside the repo). Zone ids: `pawelperfect.com` 02cb23af5c0000a110f6915b00bbb8ef, `pawelperfect.pl` 746be2887d179f7742171a605a9b797d.

## pawelperfect.com (mail-related records, as of before the change)

| Type | Name | Prio | Content | TTL |
|---|---|---|---|---|
| MX | inbound.pawelperfect.com | 87 | `route3.mx.cloudflare.net` | 1 |
| MX | inbound.pawelperfect.com | 49 | `route2.mx.cloudflare.net` | 1 |
| MX | inbound.pawelperfect.com | 16 | `route1.mx.cloudflare.net` | 1 |
| MX | pawelperfect.com | 10 | `alt4.aspmx.l.google.com` | 1 |
| MX | pawelperfect.com | 10 | `alt3.aspmx.l.google.com` | 1 |
| MX | pawelperfect.com | 5 | `alt2.aspmx.l.google.com` | 1 |
| MX | pawelperfect.com | 5 | `alt1.aspmx.l.google.com` | 1 |
| MX | pawelperfect.com | 1 | `aspmx.l.google.com` | 1 |
| MX | send.pawelperfect.com | 10 | `feedback-smtp.eu-west-1.amazonses.com` | 1 |
| TXT | cf2024-1._domainkey.pawelperfect.com |  | `"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCA...` | 1 |
| TXT | _dmarc.pawelperfect.com |  | `v=DMARC1; p=none; rua=mailto:hello@pawelperfect.com; fo=1` | 1 |
| TXT | google._domainkey.pawelperfect.com |  | `"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsOvExtt...` | 1 |
| TXT | inbound.pawelperfect.com |  | `"v=spf1 include:_spf.mx.cloudflare.net ~all"` | 1 |
| TXT | pawelperfect.com |  | `"google-site-verification=Xu3l8hsEtqnlV5WVNclwvAgwPTkY-Vu8LvkFXIlVb2k"` | 1 |
| TXT | pawelperfect.com |  | `"v=spf1 include:_spf.google.com ~all"` | 1 |
| TXT | resend._domainkey.pawelperfect.com |  | `"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC680so5N6wz1milkBSMIAUh7lcgHQ...` | 1 |
| TXT | send.pawelperfect.com |  | `"v=spf1 include:amazonses.com ~all"` | 1 |

## pawelperfect.pl (mail-related records, as of before the change)

| Type | Name | Prio | Content | TTL |
|---|---|---|---|---|
| MX | pawelperfect.pl | 5 | `alt2.aspmx.l.google.com` | 3600 |
| MX | pawelperfect.pl | 10 | `alt3.aspmx.l.google.com` | 3600 |
| MX | pawelperfect.pl | 10 | `alt4.aspmx.l.google.com` | 3600 |
| MX | pawelperfect.pl | 5 | `alt1.aspmx.l.google.com` | 3600 |
| MX | pawelperfect.pl | 1 | `aspmx.l.google.com` | 3600 |
| MX | send.pawelperfect.pl | 10 | `feedback-smtp.eu-west-1.amazonses.com` | 1 |
| TXT | _dmarc.pawelperfect.pl |  | `"v=DMARC1; p=none;"` | 1 |
| TXT | google._domainkey.pawelperfect.pl |  | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsOvExttQ...` | 1 |
| TXT | pawelperfect.pl |  | `"v=spf1 include:_spf.google.com ~all"` | 3600 |
| TXT | pawelperfect.pl |  | `"google-site-verification=St0BDXefYZ5x2X0zEYV3rq626QowSx_snCo4Y9tBtlg"` | 3600 |
| TXT | resend._domainkey.pawelperfect.pl |  | `"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6+4SK4yfDofJiLg1LK9RaSlKQByC...` | 1 |
| TXT | send.pawelperfect.pl |  | `"v=spf1 include:amazonses.com ~all"` | 1 |

