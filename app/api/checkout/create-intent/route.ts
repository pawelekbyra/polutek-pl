import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment.service';
import { UserService } from '@/lib/services/user.service';
import { rateLimit } from '@/lib/rate-limit';
import { checkoutSchema, validatePaymentAmountMinor } from '@/lib/payments/checkout.schema';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors';
import { RateLimitConfigurationError, resolveRedisRestEnv } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
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
    await UserService.getOrCreateUser(userId);

    const body = await req.json();
    const result = checkoutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: "INVALID_INPUT",
        message: "Nieprawidłowe dane.",
        details: result.error.flatten()
      }, { status: 400 });
    }

    const { amountMinor, currency, title, creatorId } = result.data;

    const amountError = validatePaymentAmountMinor(amountMinor, currency);

    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 400 });
    }

    if (creatorId) {
      const creator = await prisma.creator.findUnique({
        where: { id: creatorId },
        select: { id: true, isApproved: true },
      });

      if (!creator || !creator.isApproved) {
        return NextResponse.json({ error: 'Invalid creator' }, { status: 400 });
      }
    }

    const payment = await PaymentService.createPayment({
      userId,
      amountMinor,
      currency,
      title,
      creatorId,
    });

    return NextResponse.json({
        clientSecret: payment.clientSecret,
        paymentId: payment.id
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitConfigurationError) {
        const { missing } = resolveRedisRestEnv();
        console.error("[RATE_LIMIT_CONFIG_ERROR]", {
            route: "/api/checkout/create-intent",
            missing,
        });
        return NextResponse.json(
            {
                error: "SERVICE_CONFIGURATION_ERROR",
                message: "Płatności są chwilowo niedostępne."
            },
            { status: 503 }
        );
    }
    return handleApiError(error);
  }
}
