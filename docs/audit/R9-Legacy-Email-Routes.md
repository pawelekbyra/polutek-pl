# R9 Legacy Email Routes Inventory

| Route | Method | Status | Notes |
| :--- | :--- | :--- | :--- |
| `/api/admin/emails/broadcast` | POST | MIGRATED | Uses `sendAdminBroadcastEmail` use case. |
| `/api/admin/emails/broadcast` | GET | MIGRATED | Uses `listAdminBroadcastEmails` use case. |
| `/api/webhooks/resend` | POST | MIGRATED | Uses `handleResendWebhook` use case. |
| `/api/admin/emails/responses` | GET/PATCH | LEGACY | Uses direct Prisma. Target for R9 pass. |
| `/api/admin/templates` | GET/POST | LEGACY | Uses direct Prisma. R10 cleanup target. |
| `/api/admin/subscribers/resync` | POST | LEGACY | Boundary between Users and Email. |

## Classification Definitions
- **MIGRATED**: Logic fully resides in domain use cases; route is a thin boundary.
- **PARTIAL**: Route uses some domain logic but still has direct Prisma or legacy service calls.
- **LEGACY**: Route directly interacts with database or legacy services without a domain layer.
- **FUTURE R9**: Planned for migration within the R9 (Email) scope.
- **FUTURE R10**: Planned for cleanup during the R10 (Legacy Cleanup) scope.
