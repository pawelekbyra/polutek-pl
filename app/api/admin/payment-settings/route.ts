import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/lib/constants';
import { handleApiError } from '@/lib/errors';
import { createAppContextFromRequest } from '@/lib/api/app-context-factory';
import { getPaymentSettings, updatePaymentSettings } from '@/lib/modules/payments';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  limits: z.array(z.object({
    currency: z.enum(SUPPORTED_CURRENCIES),
    minAmount: z.number().positive().max(1_000_000),
  })).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await createAppContextFromRequest(request.headers.get('x-request-id') || undefined);
    const result = await getPaymentSettings(ctx);

    if (!result.ok) {
        return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ limits: result.data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await createAppContextFromRequest(request.headers.get('x-request-id') || undefined);
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await updatePaymentSettings({ limits: parsed.data.limits }, ctx);

    if (!result.ok) {
        return NextResponse.json({ error: result.error.message }, { status: result.error.message.includes('Forbidden') ? 403 : 400 });
    }

    return NextResponse.json({ limits: result.data });
  } catch (error) {
    return handleApiError(error);
  }
}
