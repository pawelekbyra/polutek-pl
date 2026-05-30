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
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    error: "Method Not Allowed",
    message: "Proszę użyć metody POST, aby wygenerować nową sesję płatności. Żądania GET są blokowane ze względu na cache."
  }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
        const authData = await auth();
        userId = authData.userId;
    } catch (e: any) {
        console.error("[Checkout] Clerk Handshake Failed:", e.message);
        return NextResponse.json({
            error: "CLERK_ERROR",
            message: "Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API CLERK_SECRET_KEY i NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY w panelu Vercel. Muszą pochodzić z tego samego projektu."
        }, { status: 500 });
    }

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

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

    const session = await PaymentService.createCheckoutSession({
      userId,
      amount,
      currency,
      title,
      creatorId: creatorId || undefined,
      successUrl: `${appUrl}/?success=true`,
      cancelUrl: `${appUrl}/?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("[STRIPE_CHECKOUT_ERROR]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      error: "Internal Error",
      message
    }, { status: 500 });
  }
}
