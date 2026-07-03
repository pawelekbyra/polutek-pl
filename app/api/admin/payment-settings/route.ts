import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/lib/constants';
import { handleApiError } from '@/lib/errors';
import { requireAdminForApi } from '@/lib/auth-utils';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getPaymentSettings, updatePaymentSettings } from '@/lib/modules/payments';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  limits: z.array(z.object({
    currency: z.enum(SUPPORTED_CURRENCIES),
    minAmount: z.number().positive().max(1_000_000),
    patronThreshold: z.number().positive().max(1_000_000).nullable().optional(),
    patronBoxMin: z.number().positive().max(1_000_000).nullable().optional(),
  })).min(1),
});

export async function GET(request: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi('GET_PAYMENT_SETTINGS');
  if (response) return response;

  try {
    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId! } });
    const result = await getPaymentSettings(ctx);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode ?? 400 });
    }

    return NextResponse.json({ limits: result.data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi('PATCH_PAYMENT_SETTINGS');
  if (response) return response;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId! } });
    const result = await updatePaymentSettings({ limits: parsed.data.limits }, ctx);

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode ?? 400 });
    }

    return NextResponse.json({ limits: result.data });
  } catch (error) {
    return handleApiError(error);
  }
}
