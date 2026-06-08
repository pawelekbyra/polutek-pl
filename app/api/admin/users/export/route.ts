import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { normalizePaymentTotals } from '@/lib/services/user-access.service';
import { parseUserQueryParams } from '@/lib/services/admin/admin-query-parser';
import { writeAuditLog } from '@/lib/services/audit.service';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId: actorId } = await auth();
  const { response } = await requireAdminForApi("EXPORT_ADMIN_USERS");
  if (response) return response;

  const options = parseUserQueryParams(req);

  try {
    const where: any = {
        AND: [
          options.query ? {
            OR: [
              { email: { contains: options.query, mode: 'insensitive' } },
              { name: { contains: options.query, mode: 'insensitive' } },
              { username: { contains: options.query, mode: 'insensitive' } },
            ]
          } : {},
          options.role ? { role: options.role } : {},
          options.isPatron !== undefined ? { isPatron: options.isPatron } : {},
          options.language ? { language: options.language } : {},
          options.isDeleted !== undefined ? { isDeleted: options.isDeleted } : {},
          options.patronSource ? { patronSource: options.patronSource } : {},
          options.hasPayments ? { payments: { some: {} } } : {},
          options.hasSubscriptions ? { subscriptions: { some: {} } } : {},
        ]
    };

    const users = await prisma.user.findMany({
      where,
      include: {
        paymentTotals: true,
      },
      orderBy: { createdAt: 'desc' }
    });

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
      const normalizedTotal = normalizePaymentTotals(user.paymentTotals);
      csvRows.push([
        sanitizeCsvField(user.id),
        sanitizeCsvField(user.email),
        sanitizeCsvField(user.name),
        sanitizeCsvField(user.username),
        sanitizeCsvField(user.role),
        sanitizeCsvField(user.isPatron),
        sanitizeCsvField(user.patronSince ? user.patronSince.toISOString() : ''),
        sanitizeCsvField(user.patronSource),
        sanitizeCsvField(normalizedTotal.toFixed(2)),
        sanitizeCsvField(user.language),
        sanitizeCsvField(user.isDeleted),
        sanitizeCsvField(user.createdAt.toISOString())
      ].join(','));
    }

    const csvContent = csvRows.join('\n');

    await writeAuditLog({
        actorUserId: actorId,
        action: "USERS_EXPORT",
        targetType: "System",
        metadata: { filterOptions: options, count: users.length }
    });

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
