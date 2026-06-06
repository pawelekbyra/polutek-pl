import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/constants';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { writeAuditLog } from '@/lib/services/audit.service';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  limits: z.array(z.object({
    currency: z.enum(SUPPORTED_CURRENCIES),
    minAmount: z.number().positive().max(1_000_000),
  })).min(1),
});

export async function GET() {
  const { response } = await requireAdminForApi('GET_PAYMENT_SETTINGS');
  if (response) return response;

  try {
    return NextResponse.json({ limits: await getPaymentCurrencyLimits() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi('PATCH_PAYMENT_SETTINGS');
  if (response) return response;

  try {
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.$transaction(parsed.data.limits.map(({ currency, minAmount }) => (
      prisma.paymentCurrencySetting.upsert({
        where: { currency },
        create: { currency, minAmountMinor: Math.round(minAmount * 100) },
        update: { minAmountMinor: Math.round(minAmount * 100) },
      })
    )));

    await writeAuditLog({
      actorUserId: adminUserId,
      action: 'PAYMENT_SETTINGS_UPDATED',
      targetType: 'PaymentCurrencySetting',
      metadata: { currencies: parsed.data.limits.map((limit) => limit.currency) },
    });

    return NextResponse.json({ limits: await getPaymentCurrencyLimits() });
  } catch (error) {
    return handleApiError(error);
  }
}
