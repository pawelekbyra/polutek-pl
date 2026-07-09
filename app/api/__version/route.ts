import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = false;

export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || 'development';

  return NextResponse.json(
    { buildId },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Content-Type': 'application/json',
      },
    }
  );
}
