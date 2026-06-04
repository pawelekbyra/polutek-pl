import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * LEGACY endpoint: channel subscriptions are no longer used for content access.
 * Premium/patron-only access is based only on User.isPatron.
 */
export async function GET() {
  return NextResponse.json({ isSubscribed: false, legacy: true });
}

export async function POST() {
  return NextResponse.json(
    { error: 'SUBSCRIPTIONS_LEGACY', message: 'Subskrypcje nie są już mechanizmem dostępu. Wesprzyj kanał jednorazowym napiwkiem, aby zostać Patronem.' },
    { status: 410 },
  );
}
