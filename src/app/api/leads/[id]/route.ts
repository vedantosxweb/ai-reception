import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await requireSession();
    if (error) return error;

    const body = await req.json();
    const { status } = body;

    const lead = await db.lead.update({
      where: { 
        id,
        tenantId: session.user.tenantId
      },
      data: { status }
    });

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('[Lead PATCH API] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
