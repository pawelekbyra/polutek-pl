import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const templateSchema = z.object({
  subjectPl: z.string().min(1).max(150),
  bodyPl: z.string().min(1).max(50_000),
  subjectEn: z.string().min(1).max(150),
  bodyEn: z.string().min(1).max(50_000),
});

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const template = await prisma.emailTemplate.findUnique({
        where: { name: 'WELCOME' }
    });

    return NextResponse.json(template || {
        name: 'WELCOME',
        subjectPl: 'Witaj w POLUTEK.PL!',
        bodyPl: `
          <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
            <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w POLUTEK.PL</h1>
            <p>Cześć!</p>
            <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy, takich jak komentowanie i ocenianie materiałów.</p>
            <p>Jeśli chcesz odblokować dostęp do <strong>Strefy Patrona</strong> i oglądać ekskluzywne materiały, możesz wesprzeć projekt dowolnym napiwkiem.</p>
            <p>Odwiedź <a href="https://polutek.pl" style="color: #3b82f6; font-weight: bold; text-decoration: none;">POLUTEK.PL</a>, aby zobaczyć najnowsze filmy.</p>
            <br />
            <p style="font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 16px;">Pozdrawiamy,<br />Zespół POLUTEK.PL</p>
          </div>
        `,
        subjectEn: 'Welcome to POLUTEK.PL!',
        bodyEn: `
          <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
            <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Welcome to POLUTEK.PL</h1>
            <p>Hello!</p>
            <p>Thank you for joining our community. You now have access to basic platform features like commenting and rating materials.</p>
            <p>If you want to unlock access to the <strong>Patron Zone</strong> and watch exclusive content, you can support the project with any tip.</p>
            <p>Visit <a href="https://polutek.pl" style="color: #3b82f6; font-weight: bold; text-decoration: none;">POLUTEK.PL</a> to see the latest videos.</p>
            <br />
            <p style="font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 16px;">Best regards,<br />POLUTEK.PL Team</p>
          </div>
        `
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const result = templateSchema.safeParse(data);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 });
    }

    const { subjectPl, bodyPl, subjectEn, bodyEn } = result.data;

    const updated = await prisma.emailTemplate.upsert({
      where: { name: 'WELCOME' },
      update: { subjectPl, bodyPl, subjectEn, bodyEn },
      create: { name: 'WELCOME', subjectPl, bodyPl, subjectEn, bodyEn }
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}
