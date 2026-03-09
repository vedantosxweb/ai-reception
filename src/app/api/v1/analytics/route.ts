// =============================================================================
// Analytics API - Dashboard metrics, call volume, usage
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { BillingService } from '@/lib/billing/creem.service';

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error as Response;

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '7d';

  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Call statistics
    const [
      totalCalls,
      completedCalls,
      inboundCalls,
      outboundCalls,
      totalTransfers,
      totalSMS,
      leadsCaptured,
      avgDuration,
      sentimentCounts,
      intentCounts,
      recentCalls,
      dailyCallVolume,
      missedCallsRecovered,
      highValueLeads,
    ] = await Promise.all([
      db.call.count({ where: { tenantId, startedAt: { gte: startDate } } }),
      db.call.count({ where: { tenantId, status: 'COMPLETED', startedAt: { gte: startDate } } }),
      db.call.count({ where: { tenantId, direction: 'INBOUND', startedAt: { gte: startDate } } }),
      db.call.count({ where: { tenantId, direction: 'OUTBOUND', startedAt: { gte: startDate } } }),
      db.transfer.count({ where: { tenantId, createdAt: { gte: startDate } } }),
      db.sMSMessage.count({ where: { tenantId, createdAt: { gte: startDate } } }),
      db.contact.count({ where: { tenantId, createdAt: { gte: startDate } } }),
      db.call.aggregate({
        where: { tenantId, status: 'COMPLETED', startedAt: { gte: startDate } },
        _avg: { duration: true },
      }),
      db.call.groupBy({
        by: ['sentiment'],
        where: { tenantId, startedAt: { gte: startDate }, sentiment: { not: null } },
        _count: { id: true },
      }),
      db.call.groupBy({
        by: ['intent'],
        where: { tenantId, startedAt: { gte: startDate }, intent: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      db.call.findMany({
        where: { tenantId, startedAt: { gte: startDate } },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          receptionist: { select: { name: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      // Daily volume - raw query for grouping by date
      db.call.findMany({
        where: { tenantId, startedAt: { gte: startDate } },
        select: { startedAt: true, direction: true },
      }),
      db.callEvent.count({
        where: { tenantId, type: 'missed_call_recovery_sms_sent', createdAt: { gte: startDate } },
      }),
      db.callEvent.count({
        where: { tenantId, type: 'high_value_lead', createdAt: { gte: startDate } },
      }),
    ]);

    // Process daily volume
    const dailyMap = new Map<string, { inbound: number; outbound: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap.set(key, { inbound: 0, outbound: 0 });
    }

    for (const call of dailyCallVolume) {
      const key = call.startedAt.toISOString().split('T')[0];
      const entry = dailyMap.get(key);
      if (entry) {
        if (call.direction === 'INBOUND') entry.inbound++;
        else entry.outbound++;
      }
    }

    const callVolume = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .reverse();

    // Sentiment breakdown
    const sentimentBreakdown: Record<string, number> = {};
    for (const s of sentimentCounts) {
      if (s.sentiment) sentimentBreakdown[s.sentiment] = s._count.id;
    }

    // Top intents
    const topIntents = intentCounts.map((i) => ({
      intent: i.intent || 'unknown',
      count: i._count.id,
      percentage: totalCalls > 0 ? Math.round((i._count.id / totalCalls) * 100) : 0,
    }));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ADVANCED ANALYTICS: Sentiment Trend, Peak Hours, Conversions
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Sentiment trend over time (group by date + sentiment)
    const sentimentTrendRaw = await db.call.findMany({
      where: { tenantId, startedAt: { gte: startDate }, sentiment: { not: null } },
      select: { startedAt: true, sentiment: true },
    });

    const sentimentTrendMap = new Map<string, { POSITIVE: number; NEUTRAL: number; NEGATIVE: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      sentimentTrendMap.set(key, { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 });
    }
    for (const call of sentimentTrendRaw) {
      const key = call.startedAt.toISOString().split('T')[0];
      const entry = sentimentTrendMap.get(key);
      if (entry && call.sentiment) {
        entry[call.sentiment as keyof typeof entry]++;
      }
    }
    const sentimentTrend = Array.from(sentimentTrendMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .reverse();

    // Peak hours heatmap (group by hour + dayOfWeek)
    const peakHoursRaw = await db.call.findMany({
      where: { tenantId, startedAt: { gte: startDate } },
      select: { startedAt: true },
    });

    const peakHoursMap: Record<string, number> = {};
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        peakHoursMap[`${dow}-${h}`] = 0;
      }
    }
    for (const call of peakHoursRaw) {
      const d = call.startedAt;
      const key = `${d.getDay()}-${d.getHours()}`;
      peakHoursMap[key] = (peakHoursMap[key] || 0) + 1;
    }
    const peakHours = Object.entries(peakHoursMap).map(([key, count]) => {
      const [dow, hour] = key.split('-').map(Number);
      return { dayOfWeek: dow, hour, count };
    });

    // Conversion tracking: bookings from appointments vs total calls
    const totalAppointments = await db.appointment.count({
      where: { tenantId, createdAt: { gte: startDate } },
    });
    const bookingRate = totalCalls > 0 ? Math.round((totalAppointments / totalCalls) * 100) : 0;
    const avgAppointmentValue = Number(process.env.AVERAGE_APPOINTMENT_VALUE || '200');
    const revenueGenerated = Math.round(totalAppointments * (isNaN(avgAppointmentValue) ? 200 : avgAppointmentValue));

    // Resolution rate trend (daily)
    const resolutionTrendMap = new Map<string, { completed: number; total: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      resolutionTrendMap.set(key, { completed: 0, total: 0 });
    }
    for (const call of dailyCallVolume) {
      const key = call.startedAt.toISOString().split('T')[0];
      const entry = resolutionTrendMap.get(key);
      if (entry) {
        entry.total++;
      }
    }
    // Need completed calls with dates
    const completedCallDates = await db.call.findMany({
      where: { tenantId, status: 'COMPLETED', startedAt: { gte: startDate } },
      select: { startedAt: true },
    });
    for (const call of completedCallDates) {
      const key = call.startedAt.toISOString().split('T')[0];
      const entry = resolutionTrendMap.get(key);
      if (entry) entry.completed++;
    }
    const resolutionTrend = Array.from(resolutionTrendMap.entries())
      .map(([date, { completed, total }]) => ({
        date,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        total,
      }))
      .reverse();

    // Usage summary
    let usageSummary: Awaited<ReturnType<typeof BillingService.getUsageSummary>> | null = null;
    try {
      usageSummary = await BillingService.getUsageSummary(tenantId);
    } catch {
      // Non-fatal
    }

    // Receptionists count
    const activeReceptionists = await db.aIReceptionist.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const activePhoneNumbers = await db.phoneNumber.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCalls,
          completedCalls,
          inboundCalls,
          outboundCalls,
          totalTransfers,
          totalSMS,
          appointmentsBooked: totalAppointments,
          leadsCaptured,
          revenueGenerated,
          missedCallsRecovered,
          highValueLeads,
          avgCallDuration: Math.round(avgDuration._avg.duration || 0),
          transferRate: totalCalls > 0 ? Math.round((totalTransfers / totalCalls) * 100) : 0,
          resolutionRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
          activeReceptionists,
          activePhoneNumbers,
        },
        sentimentBreakdown,
        topIntents,
        callVolume,
        recentCalls: recentCalls.map((c) => ({
          id: c.id,
          callerNumber: c.callerNumber,
          contactName: c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : null,
          receptionistName: c.receptionist?.name,
          direction: c.direction,
          status: c.status,
          duration: c.duration,
          sentiment: c.sentiment,
          intent: c.intent,
          startedAt: c.startedAt,
        })),
        usage: usageSummary,
        period: { days, startDate },
        // Advanced analytics
        sentimentTrend,
        peakHours,
        conversions: {
          totalAppointments,
          bookingRate,
          resolutionTrend,
        },
      },
    });
  } catch (err) {
    console.error('[Analytics] Error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load analytics' }, { status: 500 });
  }
}
