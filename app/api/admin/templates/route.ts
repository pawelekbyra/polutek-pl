import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { z } from 'zod';
import { createScopedLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import {
  listEmailTemplates,
  getEmailTemplateBySlug,
  upsertEmailTemplate,
  deleteEmailTemplate
} from '@/lib/modules/email';
import { createAppContext } from '@/lib/modules/shared/app-context';

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

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const ctx = createAppContext({
        actor: { type: 'admin', userId: adminUserId },
        requestId: requestId || undefined
    });

    const slug = req.nextUrl.searchParams.get('slug');
    if (slug) {
        const result = await getEmailTemplateBySlug(ctx, slug);
        if (!result.ok) {
            return NextResponse.json(
                { error: result.error.message, code: result.error.code },
                { status: result.error.statusCode }
            );
        }
        return NextResponse.json(result.data);
    }

    const result = await listEmailTemplates(ctx);
    if (!result.ok) {
        // This should not happen as listEmailTemplates returns never as error type
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (err) {
    scopedLogger.error("[GET_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id');
  const scopedLogger = createScopedLogger(requestId);
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_TEMPLATES");
  if (response) return response;

  try {
    const data = await req.json();
    const parseResult = templateSchema.safeParse(data);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid data', details: parseResult.error.flatten() }, { status: 400 });
    }

    const ctx = createAppContext({
        actor: { type: 'admin', userId: adminUserId },
        requestId: requestId || undefined
    });

    const result = await upsertEmailTemplate(ctx, parseResult.data);

    if (!result.ok) {
        return NextResponse.json(
            { error: result.error.message, code: result.error.code },
            { status: result.error.statusCode }
        );
    }

    return NextResponse.json(result.data);
  } catch (err) {
    scopedLogger.error("[POST_ADMIN_TEMPLATES_ERROR]", err);
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
    const requestId = req.headers.get('x-request-id');
    const scopedLogger = createScopedLogger(requestId);
    const { adminUserId, response } = await requireAdminForApi("DELETE_ADMIN_TEMPLATES");
    if (response) return response;

    try {
        const slug = req.nextUrl.searchParams.get('slug');
        if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

        const ctx = createAppContext({
            actor: { type: 'admin', userId: adminUserId },
            requestId: requestId || undefined
        });

        const result = await deleteEmailTemplate(ctx, slug);

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error.message, code: result.error.code },
                { status: result.error.statusCode }
            );
        }

        return NextResponse.json(result.data);
    } catch (err) {
        scopedLogger.error("[DELETE_ADMIN_TEMPLATES_ERROR]", err);
        return handleApiError(err);
    }
}
