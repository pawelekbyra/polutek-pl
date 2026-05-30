import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment.service';
import { UserService } from '@/lib/services/user.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  title: z.string().min(1),
  creatorId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        error: "Unauthorized",
        message: "Twoja sesja wygasła. Zaloguj się ponownie, aby dokonać wpłaty."
      }, { status: 401 });
    }

    // Lazy Sync Fallback via Service
    await UserService.getOrCreateUser(userId);

    const body = await req.json();
    const result = checkoutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request data", details: result.error.flatten() }, { status: 400 });
    }

    const { amount, currency, title, creatorId } = result.data;
    const minAmount = currency === 'PLN' ? 20 : 5;

    if (amount < minAmount) {
      return NextResponse.json({ error: `Minimum parameters (min. ${minAmount} ${currency})` }, { status: 400 });
    }

    const payment = await PaymentService.createPayment({
      userId,
      amount,
      currency,
      title,
      creatorId,
    });

    return NextResponse.json({
        clientSecret: payment.clientSecret,
        paymentId: payment.id
    });
  } catch (error: unknown) {
    console.error("[STRIPE_INTENT_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      error: "Internal Error",
      message
    }, { status: 500 });
  }
}
