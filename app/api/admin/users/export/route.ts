import { NextResponse, NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { requireAdminForApi } from '@/lib/auth-utils';
import { parseAdminUsersExportQueryParams } from '@/lib/api/admin-users-export-query';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { exportAdminUsers } from '@/lib/modules/users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { adminUserId, response } = await requireAdminForApi("EXPORT_ADMIN_USERS");
    if (response) return response;

    const ctx = createAppContext({ actor: { type: 'admin', userId: adminUserId! } });
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
