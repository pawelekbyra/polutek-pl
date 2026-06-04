# Deploy checklist

## Build
- [ ] `npm install`
- [ ] `npx prisma generate`
- [ ] `npm run lint`
- [ ] `npm run build`

## Required env variables
- [ ] `DATABASE_URL`
- [ ] `DATABASE_URL_UNPOOLED`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `CLERK_WEBHOOK_SECRET`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM`
- [ ] `ENABLE_DEMO_FALLBACKS`
- [ ] `ENABLE_CAMPAIGN_PAGE`

## Database
- [ ] `npx prisma generate`
- [ ] dev: `npx prisma db push`
- [ ] production: `npm run predeploy:prod` (generates client, deploys migrations, and runs `db:smoke`)
- [ ] seed if database is empty: `npx prisma db seed`

## Content
- [ ] At least one approved creator exists
- [ ] One video has `isMainFeatured=true`
- [ ] Public video plays through `/api/media/:videoId`
- [ ] Patron video is blocked for non-patron users
- [ ] Patron video plays for patron users

## Payments
- [ ] Stripe webhook endpoint configured
- [ ] Test payment creates/updates Payment
- [ ] Qualifying donation grants patron
- [ ] Failed payment does not grant patron

## Final smoke test
- [ ] Home page loads
- [ ] Channel page loads
- [ ] Login works
- [ ] Admin page is blocked for non-admin
- [ ] Admin can manage videos
