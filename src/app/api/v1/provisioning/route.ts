import { NextRequest, NextResponse } from 'next/server';
import { TwilioService } from '@/lib/services/twilio.service';
import { db as prisma } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET: Lists available Twilio numbers to purchase or fetches tenant's current numbers
 */
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clerk users have a publicMetadata.tenantId in this architecture
    const tenantId = user.publicMetadata?.tenantId as string;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context missing' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Action: search numbers
    if (action === 'search') {
      const areaCode = searchParams.get('areaCode') || undefined;
      const countryCode = searchParams.get('country') || 'US';
      const results = await TwilioService.searchAvailableNumbers(countryCode, areaCode);
      return NextResponse.json({ data: results });
    }

    // Default action: List tenant's current numbers
    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { receptionist: { select: { name: true } } }
    });

    return NextResponse.json({ data: numbers });
  } catch (error: any) {
    console.error('[Provisioning GET Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Purchase a specific number and bind it to the tenant
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.publicMetadata?.tenantId as string;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context missing' }, { status: 403 });
    }

    const payload = await req.json();
    const { phoneNumber } = payload;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    // 1. Purchase via Twilio SDK (which also configures webhooks immediately)
    const providerSid = await TwilioService.purchaseAndConfigureNumber(phoneNumber);

    // 2. Save explicitly to tenant's DB scope
    const dbRecord = await prisma.phoneNumber.create({
      data: {
        tenantId,
        number: phoneNumber,
        provider: 'twilio',
        providerSid,
        status: 'ACTIVE',
        capabilities: 'voice,sms'
      }
    });

    return NextResponse.json({ data: dbRecord }, { status: 201 });

  } catch (error: any) {
    console.error('[Provisioning POST Error]', error);
    return NextResponse.json({ error: error.message || 'Provisioning Failed' }, { status: 500 });
  }
}
