import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { PaymentCheckoutService as PaymentService } from '@/lib/services/payments/checkout.service';
import { GetOrCreateUserUseCase } from '@/lib/modules/users';
import { getActorFromAuth } from '@/lib/api/auth';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { rateLimit } from '@/lib/rate-limit';
import { checkoutSchema } from '@/lib/payments/checkout.schema';
import { validatePaymentAmountMinorAsync } from '@/lib/payments/currency-settings';
import { isUuid } from '@/lib/utils/uuid';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        error: "Unauthorized",
        message: "Twoja sesja wygasła. Zaloguj się ponownie, aby dokonać wpłaty."
      }, { status: 401 });
    }

    // Rate Limiting: 10 intents per 10 mins
    const rateLimitResult = await rateLimit({
        key: `checkout:${userId}`,
        limit: 10,
        windowMs: 10 * 60 * 1000
    });

    if (!rateLimitResult.success) {
        return NextResponse.json({
            error: "Too many requests",
            message: "Zbyt wiele prób płatności. Spróbuj ponownie za 10 minut."
        }, { status: 429 });
    }

    // Lazy Sync Fallback via Service
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });
    await GetOrCreateUserUseCase.execute(ctx, userId);

    const body = await req.json();
    const result = checkoutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: "INVALID_INPUT",
        message: "Nieprawidłowe dane.",
        details: result.error.flatten()
      }, { status: 400 });
    }

    const { amountMinor, currency, title, requestId: inputRequestId } = result.data;

    const amountError = await validatePaymentAmountMinorAsync(amountMinor, currency);

    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 400 });
    }

    const payment = await PaymentService.createPayment({
      userId,
      amountMinor,
      currency,
      title,
      requestId: inputRequestId,
    });

    return NextResponse.json({
        clientSecret: payment.clientSecret,
        paymentId: payment.id
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
