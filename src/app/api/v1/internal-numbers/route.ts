import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { z } from 'zod';

const createSchema = z.object({
  number: z.string().min(1, 'Phone number is required'),
  provider: z.string().default('twilio'),
  capabilities: z.string().default('voice,sms'),
  receptionistId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const body = await req.json();
    const result = createSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { number, provider, capabilities, receptionistId } = result.data;

    // Normalize number if missing +
    let normalizedNumber = number.trim();
    if (!normalizedNumber.startsWith('+')) {
       normalizedNumber = '+' + normalizedNumber.replace(/\D/g, '');
    }

    const exists = await db.phoneNumber.findFirst({
      where: { number: normalizedNumber }
    });

    if (exists) {
      if (exists.tenantId === session.user.tenantId) {
        return NextResponse.json({ success: false, error: 'You have already registered this number.' }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: 'This number is already registered to another account.' }, { status: 400 });
    }

    if (receptionistId) {
        const rec = await db.aIReceptionist.findUnique({
             where: { id: receptionistId, tenantId: session.user.tenantId }
        });
        if (!rec) {
            return NextResponse.json({ success: false, error: 'Target Receptionist not found.' }, { status: 404 });
        }
    }

    const newNumber = await db.phoneNumber.create({
      data: {
        tenantId: session.user.tenantId,
        number: normalizedNumber,
        provider,
        capabilities,
        receptionistId: receptionistId || null,
        status: 'ACTIVE',
      },
      include: {
        receptionist: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ success: true, data: newNumber });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
