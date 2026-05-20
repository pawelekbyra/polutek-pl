# POLUTEK.COM - Private VOD & Donation Platform

A modern, responsive media platform for exclusive content, built with Next.js 14, Tailwind CSS, and Prisma. This project is designed with a professional "YouTube-style" aesthetic and features a permanent content locking mechanism for supporters based on lifetime donation value.

## Project Vision
POLUTEK.COM is a private service. It serves as a central hub for exclusive media where users can gain permanent access to restricted "Materials" by leaving a voluntary donation.

### Key Concept: Reward for Support
- **Not a Subscription**: We don't sell access as a service. Instead, we accept voluntary donations and grant lifetime access as a token of gratitude.
- **Lifetime Value (LTV)**: Access is determined by the total historical sum of donations (e.g., €5 for VIP1, €10 for VIP2).
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
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [DaisyUI](https://daisyui.com/)

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

## Legal
The platform operates on a donation basis. All "Tips" or "Donations" are voluntary contributions to the creator, not payments for services or products. Detailed terms are available on the `/regulamin` page.
