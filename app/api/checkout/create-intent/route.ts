import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment.service';
import { UserService } from '@/lib/services/user.service';
import { checkoutSchema, validatePaymentAmount } from '@/lib/payments/checkout.schema';
import { prisma } from '@/lib/prisma';

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

    // Lazy Sync Fallback via Service
    await UserService.getOrCreateUser(userId);

    const body = await req.json();
    const result = checkoutSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request data", details: result.error.flatten() }, { status: 400 });
    }

    const { amount, amountMinor: inputAmountMinor, currency, title, creatorId } = result.data;
    const amountError = validatePaymentAmount(amount, currency);

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
      amount: inputAmountMinor ? inputAmountMinor / 100 : amount,
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
