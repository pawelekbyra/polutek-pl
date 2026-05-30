import { NextRequest, NextResponse } from 'next/server';
import { POST as createIntentPost } from './create-intent/route';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    error: "Method Not Allowed",
    message: "Proszę użyć metody POST, aby wygenerować nową sesję płatności. Żądania GET są blokowane ze względu na cache."
  }, { status: 405 });
}

export async function POST(req: NextRequest) {
  return createIntentPost(req);
}
