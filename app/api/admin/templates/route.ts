import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminForApi } from '@/lib/auth-utils';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/services/audit.service';
import { auth } from '@clerk/nextjs/server';
import sanitizeHtml from 'sanitize-html';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { EMAIL_DEFAULTS, SYSTEM_TEMPLATE_SLUGS, SystemTemplateSlug } from '@/lib/email-defaults';

export const dynamic = 'force-dynamic';

const templateSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(100).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  category: z.enum(['SYSTEM', 'WELCOME', 'PAYMENT', 'PATRON', 'BROADCAST', 'MANUAL', 'OTHER']).default('OTHER'),
  isActive: z.boolean().default(true),
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

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { response } = await requireAdminForApi("GET_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (slug) {
        const template = await prisma.emailTemplate.findUnique({
            where: { slug },
        });

        if (!template && SYSTEM_TEMPLATE_SLUGS.includes(slug as SystemTemplateSlug)) {
            const defaults = EMAIL_DEFAULTS[slug as SystemTemplateSlug];
            return NextResponse.json({
                slug,
                isSystem: true,
                category: 'SYSTEM',
                isActive: true,
                ...defaults
            });
        }

        return NextResponse.json(template || { slug, subject: '', html: '' });
    }

    const templates = await prisma.emailTemplate.findMany({
        orderBy: { updatedAt: 'desc' }
    });

    // Ensure system templates are at least represented even if not in DB
    const dbSlugs = new Set(templates.map(t => t.slug));
    const allTemplates = [...templates];

    for (const sysSlug of SYSTEM_TEMPLATE_SLUGS) {
        if (!dbSlugs.has(sysSlug)) {
            const defaults = EMAIL_DEFAULTS[sysSlug];
            allTemplates.push({
                id: `sys-${sysSlug}`,
                slug: sysSlug,
                name: `System: ${sysSlug}`,
                description: 'Domyślny szablon systemowy',
                category: 'SYSTEM',
                isSystem: true,
                isActive: true,
                createdAt: new Date(0),
                updatedAt: new Date(0),
                ...defaults
            } as any);
        }
    }

    return NextResponse.json(allTemplates);
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

    const { slug, subject, html, subjectEn, htmlEn, name, description, category, isActive } = result.data;
    const cleanHtml = sanitizeHtml(html, sanitizeOptions);
    const cleanHtmlEn = htmlEn ? sanitizeHtml(htmlEn, sanitizeOptions) : null;

    const updated = await prisma.emailTemplate.upsert({
      where: { slug },
      update: {
        subject,
        html: cleanHtml,
        subjectEn,
        htmlEn: cleanHtmlEn,
        name,
        description,
        category,
        isActive
      },
      create: {
        slug,
        subject,
        html: cleanHtml,
        subjectEn,
        htmlEn: cleanHtmlEn,
        name,
        description,
        category,
        isActive,
        isSystem: SYSTEM_TEMPLATE_SLUGS.includes(slug as SystemTemplateSlug)
      },
    });

    await writeAuditLog({
      actorUserId: (await auth()).userId,
      action: 'TEMPLATE_SAVED',
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

export async function DELETE(req: NextRequest) {
    const requestId = req.headers.get('x-request-id');
    const scopedLogger = createScopedLogger(requestId);
    const { response } = await requireAdminForApi("DELETE_ADMIN_TEMPLATES");
    if (response) return response;

    try {
        const slug = req.nextUrl.searchParams.get('slug');
        if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

        const template = await prisma.emailTemplate.findUnique({ where: { slug } });
        if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (template.isSystem) {
            return NextResponse.json({ error: 'Cannot delete system template' }, { status: 403 });
        }

        await prisma.emailTemplate.delete({ where: { slug } });

        await writeAuditLog({
            actorUserId: (await auth()).userId,
            action: 'TEMPLATE_DELETED',
            targetType: 'EmailTemplate',
            targetId: template.id,
            metadata: { slug },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        scopedLogger.error("[DELETE_ADMIN_TEMPLATES_ERROR]", err);
        return handleApiError(err);
    }
}
