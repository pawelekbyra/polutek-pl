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
          options.patronSource ? { patronSource: options.patronSource } : {},
          options.language ? { language: options.language } : {},
          options.isDeleted !== undefined ? { isDeleted: options.isDeleted } : {},
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

    for (const user of users) {
      const normalizedTotal = normalizePaymentTotals(user.paymentTotals);
      csvRows.push([
        user.id,
        user.email,
        `"${(user.name || '').replace(/"/g, '""')}"`,
        `"${(user.username || '').replace(/"/g, '""')}"`,
        user.role,
        user.isPatron,
        user.patronSince ? user.patronSince.toISOString() : '',
        user.patronSource || '',
        normalizedTotal.toFixed(2),
        user.language || 'pl',
        user.isDeleted,
        user.createdAt.toISOString()
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
