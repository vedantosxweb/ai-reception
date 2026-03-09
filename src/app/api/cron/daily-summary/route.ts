// =============================================================================
// Daily Summary Cron Job
// Triggered by Vercel Cron (or manually) once per day.
// Sends a daily call summary email to OWNER/ADMIN users of each active tenant
// that received at least one call the previous day.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildAndSendDailySummary } from '@/lib/email/email.service';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for processing all tenants

export async function GET(req: NextRequest) {
  // Protect the endpoint with a secret (Vercel Cron sends this via header)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.HOST_PROVISION_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active tenants
    const tenants = await db.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process each tenant
    for (const tenant of tenants) {
      try {
        await buildAndSendDailySummary(tenant.id);
        sent++;
      } catch (error) {
        skipped++;
        errors.push(`${tenant.name}: ${(error as Error).message}`);
        console.error(`[Daily Summary] Error for tenant ${tenant.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      tenantsProcessed: tenants.length,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Daily Summary Cron] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
