import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/services/audit.service';
import { auth } from '@clerk/nextjs/server';
import sanitizeHtml from 'sanitize-html';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const DEFAULT_TEMPLATE = {
  slug: 'welcome-email',
  subject: 'Witaj w {{appName}}, {{firstName}}!',
  html: `
    <div style="font-family: serif; color: #1a1a1a; background-color: #FDFBF7; padding: 40px; line-height: 1.6; border: 1px solid #1a1a1a;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px;">Witaj w {{appName}}</h1>
      <p>Cześć {{firstName}}!</p>
      <p>Dziękujemy za dołączenie do naszej społeczności. Od teraz masz dostęp do podstawowych funkcji platformy, takich jak komentowanie i ocenianie materiałów.</p>
      <p>Jeśli chcesz odblokować dostęp do <strong>Strefy Patrona</strong> i oglądać ekskluzywne materiały, możesz wesprzeć projekt dowolnym napiwkiem.</p>
      <p>Odwiedź <a href="{{appUrl}}" style="color: #3b82f6; font-weight: bold; text-decoration: none;">{{appName}}</a>, aby zobaczyć najnowsze filmy.</p>
      <br />
      <p style="font-style: italic; border-top: 1px solid #1a1a1a; padding-top: 16px;">Pozdrawiamy,<br />Zespół {{appName}}</p>
    </div>
  `,
};

const templateSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subject: z.string().trim().min(1).max(150),
  html: z.string().min(1).max(50_000),
  subjectEn: z.string().trim().max(150).optional().nullable(),
  htmlEn: z.string().max(50_000).optional().nullable(),
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
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const slug = getSlug(req);
    const template = await prisma.emailTemplate.findUnique({
      where: { slug },
    });

    return NextResponse.json(template || { ...DEFAULT_TEMPLATE, slug });
  } catch (err) {
    scopedLogger.error("[GET_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("POST_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const data = await req.json();
    const result = templateSchema.safeParse(data);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid data', details: result.error.flatten() }, { status: 400 });
    }

    const { slug, subject, html, subjectEn, htmlEn } = result.data;
    const cleanHtml = sanitizeHtml(html, sanitizeOptions);
    const cleanHtmlEn = htmlEn ? sanitizeHtml(htmlEn, sanitizeOptions) : null;

    const updated = await prisma.emailTemplate.upsert({
      where: { slug },
      update: {
        subject,
        html: cleanHtml,
        subjectEn,
        htmlEn: cleanHtmlEn,
      },
      create: {
        slug,
        subject,
        html: cleanHtml,
        subjectEn,
        htmlEn: cleanHtmlEn,
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
    scopedLogger.error("[POST_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}
