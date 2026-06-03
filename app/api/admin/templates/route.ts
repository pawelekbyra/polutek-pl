import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth-utils';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/services/audit.service';
import { auth } from '@clerk/nextjs/server';
import sanitizeHtml from 'sanitize-html';

export const dynamic = 'force-dynamic';

const DEFAULT_TEMPLATE = {
  slug: 'welcome-email',
  subject: 'Witaj w POLUTEK.PL, {{firstName}}!',
  html: `
    <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w POLUTEK.PL</h1>
      <p>Cześć {{firstName}}!</p>
      <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy, takich jak komentowanie i ocenianie materiałów.</p>
      <p>Jeśli chcesz odblokować dostęp do <strong>Strefy Patrona</strong> i oglądać ekskluzywne materiały, możesz wesprzeć projekt dowolnym napiwkiem.</p>
      <p>Odwiedź <a href="https://polutek.pl" style="color: #3b82f6; font-weight: bold; text-decoration: none;">POLUTEK.PL</a>, aby zobaczyć najnowsze filmy.</p>
      <br />
      <p style="font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 16px;">Pozdrawiamy,<br />Zespół POLUTEK.PL</p>
    </div>
  `,
};

const templateSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subject: z.string().trim().min(1).max(150),
  html: z.string().min(1).max(50_000),
});

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'div', 'h1', 'h2', 'h3', 'br', 'span', 'section', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'img',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['style', 'class'],
    a: ['style', 'class', 'href', 'target', 'rel'],
    img: ['style', 'class', 'src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https'],
  },
};

function getSlug(req: NextRequest) {
  return req.nextUrl.searchParams.get('slug') || DEFAULT_TEMPLATE.slug;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const slug = getSlug(req);
    const template = await prisma.emailTemplate.findUnique({
      where: { slug },
    });

    return NextResponse.json(template || { ...DEFAULT_TEMPLATE, slug });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await req.json();
    const result = templateSchema.safeParse(data);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 });
    }

    const { slug, subject, html } = result.data;
    const cleanHtml = sanitizeHtml(html, sanitizeOptions);

    const updated = await prisma.emailTemplate.upsert({
      where: { slug },
      update: {
        subject,
        html: cleanHtml,
      },
      create: {
        slug,
        subject,
        html: cleanHtml,
      },
    });

    await writeAuditLog({
      actorUserId: (await auth()).userId,
      action: 'TEMPLATE_UPDATED',
      targetType: 'EmailTemplate',
      targetId: updated.id,
      metadata: { slug: updated.slug },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}
