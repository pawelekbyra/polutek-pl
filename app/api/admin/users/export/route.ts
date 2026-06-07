import { prisma } from '@/lib/prisma';
import { NextResponse, NextRequest } from 'next/server';
import { requireAdminForApi } from '@/lib/auth-utils';
import { handleApiError } from '@/lib/errors';
import { normalizePaymentTotals } from '@/lib/services/user-access.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { response } = await requireAdminForApi("EXPORT_ADMIN_USERS");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || undefined;
  const role = (searchParams.get('role') as any) || undefined;
  const isPatron = searchParams.get('isPatron') === 'true' ? true : searchParams.get('isPatron') === 'false' ? false : undefined;

  try {
    const where: any = {
        AND: [
          query ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
              { username: { contains: query, mode: 'insensitive' } },
            ]
          } : {},
          role ? { role } : {},
          isPatron !== undefined ? { isPatron } : {},
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
      ['ID', 'Email', 'Name', 'Username', 'Role', 'IsPatron', 'PatronSince', 'PatronSource', 'NormalizedTotalPLN', 'CreatedAt'].join(',')
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
        user.createdAt.toISOString()
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
