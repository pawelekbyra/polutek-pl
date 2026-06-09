import { NextResponse, NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { parseAdminUsersExportQueryParams } from '@/lib/api/admin-users-export-query';
import { createAppContextFromRequest } from '@/lib/api/app-context-factory';
import { exportAdminUsers } from '@/lib/modules/users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await createAppContextFromRequest("EXPORT_ADMIN_USERS");

    if (ctx.actor.type !== 'admin') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const filters = parseAdminUsersExportQueryParams(req);
    const result = await exportAdminUsers(filters, ctx);

    if (!result.ok) {
      return handleApiError(result.error);
    }

    const users = result.data;

    const csvRows = [
      ['ID', 'Email', 'Name', 'Username', 'Role', 'IsPatron', 'PatronSince', 'PatronSource', 'NormalizedTotalPLN', 'Language', 'IsDeleted', 'CreatedAt'].join(',')
    ];

    const sanitizeCsvField = (value: any) => {
        const str = String(value ?? '');
        if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
            return `"'${str}"`;
        }
        return `"${str.replace(/"/g, '""')}"`;
    };

    for (const user of users) {
      csvRows.push([
        sanitizeCsvField(user.id),
        sanitizeCsvField(user.email),
        sanitizeCsvField(user.name),
        sanitizeCsvField(user.username),
        sanitizeCsvField(user.role),
        sanitizeCsvField(user.isPatron),
        sanitizeCsvField(user.patronSince ? user.patronSince.toISOString() : ''),
        sanitizeCsvField(user.patronSource),
        sanitizeCsvField(user.normalizedTotal.toFixed(2)),
        sanitizeCsvField(user.language),
        sanitizeCsvField(user.isDeleted),
        sanitizeCsvField(user.createdAt.toISOString())
      ].join(','));
    }

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error: unknown) {
      return handleApiError(error);
  }
}
