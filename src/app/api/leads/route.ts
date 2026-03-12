import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { ApiResponse } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          call: {
            select: {
              id: true,
              startedAt: true,
              duration: true,
              sentiment: true,
            }
          }
        }
      }),
      db.lead.count({ where: { tenantId: session.user.tenantId } }),
    ]);

    return NextResponse.json({
      success: true,
      data: leads,
      meta: { total, page, limit }
    });
  } catch (error) {
    console.error('[Leads API] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
