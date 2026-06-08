import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { PaymentCheckoutService as PaymentService } from '@/lib/services/payments/checkout.service';
import { UserProfileService as UserService } from '@/lib/services/user/profile.service';
import { rateLimit } from '@/lib/rate-limit';
import { checkoutSchema } from '@/lib/payments/checkout.schema';
import { validatePaymentAmountMinorAsync } from '@/lib/payments/currency-settings';
import { isUuid } from '@/lib/utils/uuid';
import { prisma } from '@/lib/prisma';
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

    const { amountMinor, currency, title, creatorId: inputCreatorId, requestId: inputRequestId } = result.data;

    const amountError = await validatePaymentAmountMinorAsync(amountMinor, currency);

    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 400 });
    }

    let verifiedCreatorId: string | undefined = undefined;
    if (inputCreatorId) {
      const creator = isUuid(inputCreatorId) ? await prisma.creator.findUnique({
        where: { id: inputCreatorId },
        select: { id: true, isApproved: true },
      }) : null;

      if (creator && creator.isApproved) {
        verifiedCreatorId = creator.id;
      } else {
         // If creatorId was provided but is invalid/not approved, we fail or ignore it.
         // Given the FK constraint error, it's safer to fail if it was intended but not found.
         return NextResponse.json({ error: 'Invalid creator' }, { status: 400 });
      }
    }

    const payment = await PaymentService.createPayment({
      userId,
      amountMinor,
      currency,
      title,
      creatorId: verifiedCreatorId,
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
