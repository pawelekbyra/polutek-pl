# Production Monitoring Checklist

This checklist defines the signals, thresholds, and responsibilities for monitoring Polutek.pl in production.

## Monitoring Categories

### 1. Deployment (Vercel)
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Build Status | Vercel Dashboard / Git | SUCCESS | N/A | FAILED | Operator | Per Deploy |
| Runtime Errors | Vercel Logs | < 0.1% | > 1% | > 5% | Operator | Daily |
| Domain/HTTPS | Browser / Uptime | Valid / 200 OK | Cert Exp < 7d | Timeout / Error | Operator | 5 min |
| Env Var Config | Health Check (`/api/health`) | ALL_PRESENT | N/A | MISSING | Operator | Daily |

### 2. Database (Prisma / DB Provider)
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Connectivity | Health Check (`/api/health`) | OK | Slow Response | FAILED | Operator | 5 min |
| Schema Sync | Prisma Migrate Status | UP-TO-DATE | N/A | DRIFTED | Operator | Per Deploy |
| Backup Existence| DB Dashboard | Daily backup exists | > 24h old | None found | Operator | Daily |
| Restore Verify | Manual Drill | Verified < 30d | > 60d since | Never verified| Operator | Monthly |

### 3. Stripe / Payment
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Webhook Delivery | Stripe Dashboard | 100% Success | < 95% | < 80% | Operator | Daily |
| Webhook Sig | App Logs | Valid | N/A | Signature Fail | Operator | Daily |
| Reconciliation | Audit Logs | Payment == Grant | 1 mismatch | > 5 mismatch | Operator | Daily |
| Refund/Dispute | App Logs | Grant Revoked | Delay > 1h | No revocation | Operator | Daily |

### 4. Patron Access
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Access Truth | Access Diagnostics | Grant is source | `User.isPatron` drift| Grant ignored | Operator | Daily |
| Clerk Sync | Admin UI | Metadata == Grant | Drift found | N/A | Operator | Weekly |
| Denied Access | Support / Logs | Denied works | Intermittent | Access Leak | Operator | Daily |

### 5. Cloudflare / Video
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Asset Status | Admin Media Tab | READY | > 2 Processing | FAILED | Operator | Daily |
| Webhook Delivery | CF Dashboard | 100% Success | < 95% | < 80% | Operator | Daily |
| Playback Tokens | App Logs | Signed / Valid | Loop detected | Resolution Fail| Operator | Daily |
| Usage/Cost | CF Dashboard | Within Budget | > 80% Budget | > 100% Budget | Owner | Weekly |

### 6. Playback Security
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Unauthorized Call| CF Dashboard / Logs | 0 for private | > 10 / hour | > 100 / hour | Operator | Daily |
| Token Leakage | Network Inspector | None in Denied | N/A | Leak Confirmed | Operator | Per Deploy |
| Private URL Leak| App Logs / Reports | None | N/A | Leak Confirmed | Operator | Continuous|

### 7. Auth (Clerk)
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Auth Availability| Clerk Dashboard | 100% | < 99.9% | < 99% | Operator | Daily |
| Role Resolution | App Logs | Admin recognized | N/A | Guest == Admin | Operator | Daily |
| Webhook Sync | Clerk Dashboard | 100% Success | < 95% | < 80% | Operator | Daily |

### 8. Comments
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| Public Read | Smoke Test | 200 OK (Guest) | N/A | 403 Forbidden | Operator | Per Deploy |
| Gated Write | Smoke Test | 403 Denied (Guest) | N/A | Guest Can Post | Operator | Per Deploy |
| Moderation | Admin UI | Visible / Hidden | > 10 Pending | Queue Stuck | Operator | Daily |

### 9. Email (Resend)
| Signal | Source | Normal State | Warning | Critical | Owner | Frequency |
| --- | --- | --- | --- | --- | --- | --- |
| API Success | Resend Dashboard | 100% Success | < 95% | < 80% | Operator | Daily |
| Deliverability | Resend Dashboard | > 98% Delivered | Bounce > 5% | Complaint > 0.1%| Operator | Daily |
| DNS / Domain | Resend Dashboard | Verified | N/A | Unverified | Operator | Weekly |

## Monitoring Evidence Capture

- **Redaction Rule:** Never capture `sk_live`, `whsec`, `Authorization` headers, full `playbackToken`, or PII (emails/addresses).
- **Format:** Screenshots of provider dashboards (redacted) or JSON excerpts of logs (redacted).
- **Storage:** Internal secure operations folder; do not commit to public repository.

## Gap Matrix

| Monitoring Area | Repository Evidence | Production Evidence | Status | Next Action | Follow-up Ticket |
| --- | --- | --- | --- | --- | --- |
| Health Check | `app/api/health` | None | PARTIAL | Configure `HEALTHCHECK_TOKEN` | production-healthcheck-hardening |
| Webhook Alerting | None | Provider Dashboards| PARTIAL | Enable Dashboard Alerts | webhook-delivery-alerting |
| DB Backups | None | None | UNKNOWN | Confirm DB Provider Config | database-backup-restore-drill |
| Reconciliation | `lib/modules/patron` | None | PARTIAL | Scripted reconciliation | payment-patrongrant-reconciliation-alert |
| CF Processing | `lib/modules/video` | None | PARTIAL | Monitor Processing durations | cloudflare-processing-stuck-alert |
| PII / Security | `lib/logger.ts` | None | READY | Regular manual log audit | N/A |
