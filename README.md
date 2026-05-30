# POLUTEK.PL - Private VOD & Donation Platform

## Important for AI coding agents
Before changing code, read `PROJECT_CONTEXT.md`.
This project should be developed according to product behavior, not only technical stack.

A modern, responsive media platform for exclusive content, built with Next.js 14, Tailwind CSS, and Prisma. This project is designed with a professional "YouTube-style" aesthetic and features a permanent content locking mechanism for supporters based on lifetime donation value.

## Project Vision
POLUTEK.PL is a private service. It serves as a central hub for exclusive media where users can gain permanent access to restricted "Materials" by leaving a voluntary donation.

### Key Concept: Reward for Support
- **Not a Subscription**: We don't sell access as a service. Instead, we accept voluntary donations and grant lifetime access as a token of gratitude.
- **Lifetime Value (LTV)**: Access is determined by the historical Patron status (granted after a single donation above the current threshold, e.g., 20 PLN).
- **Public Discovery**: One primary featured video is always public, serving as a gateway to the platform.

## Architecture & Scalability
The platform is built with future growth and high performance in mind:

- **Multi-Tenancy**: The database schema (Prisma) is designed for multiple creators. Every video, comment, and transaction is linked to a `creatorId`.
- **Clean Architecture**: Business logic is decoupled from API routes into a dedicated Service Layer (`lib/services/`), facilitating testing and maintainability.
- **Connection Pooling**: Optimized for serverless environments using connection pooling to prevent database exhaustion.
- **High-Performance VOD**: Designed for adaptive streaming (HLS/DASH) to ensure smooth playback across all devices and bandwidth conditions.
- **Social Features**: Multi-level threaded comments, image attachments, and likes for high community engagement.

## Technology Stack
- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Database**: [Postgres (Neon/Supabase)](https://neon.tech/) with [Prisma 6+](https://www.prisma.io/)
- **Payments**: [Stripe](https://stripe.com/)
- **Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Email**: [Resend](https://resend.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)

## Database Configuration

This project uses Prisma with PostgreSQL. It requires two database connection strings in your environment variables:

- `DATABASE_URL`: Can be a pooled connection string (e.g., using Prisma Accelerate or Neon's connection pooling).
- `DATABASE_URL_UNPOOLED`: Should be a direct/unpooled connection string. This is used by Prisma for migrations and other direct database operations.
  - *Note: If your environment does not provide a separate direct URL, you can temporarily set `DATABASE_URL_UNPOOLED` to the same value as `DATABASE_URL`, but a dedicated direct URL is recommended for production.*

## Getting Started

### Prerequisites
- Node.js 18+
- Postgres instance
- Clerk project keys
- Stripe account & webhook secret

### Installation
```bash
npm install
npx prisma generate
npm run dev
```

### Database Migrations
For local development:
```bash
npx prisma migrate dev --name hardening
```
For production environments:
```bash
npx prisma migrate deploy
```
*Note: If migrations are not yet committed to the repository, you can use `npx prisma db push` for development environments, but `migrate deploy` is the standard for production.*

## Verification Checklist
1. [ ] Homepage loads correctly with a featured video.
2. [ ] Homepage shows "No materials" state when the database is empty.
3. [ ] Public videos play via `/api/media/:id`.
4. [ ] Direct `videoUrl` is not present in public component props or DTOs.
5. [ ] `REGISTERED` tier videos show paywall for guest users.
6. [ ] `PATRON` tier videos show paywall for regular logged-in users.
7. [ ] `PATRON` tier videos are accessible to patrons.
8. [ ] Stripe webhook correctly fulfills payments and grants Patron status.
9. [ ] Reaching the referral goal (5 points) grants Patron status and syncs to Clerk.
10. [ ] Webhook idempotency prevents double-processing of Stripe events.

## Legal
The platform operates on a donation basis. All "Tips" or "Donations" are voluntary contributions to the creator, not payments for services or products. Detailed terms are available on the `/regulamin` page.
