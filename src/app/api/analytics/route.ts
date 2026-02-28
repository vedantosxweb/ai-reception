/**
 * Analytics API
 * Returns comprehensive analytics data for the dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '7d' // 1d, 7d, 30d

    // Calculate date range
    const now = new Date()
    const daysAgo = period === '30d' ? 30 : period === '7d' ? 7 : 1
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

    // Get contact counts
    const totalContacts = await db.contact.count()
    const newContacts = await db.contact.count({
      where: { createdAt: { gte: startDate } }
    })

    // Get appointment counts
    const totalAppointments = await db.appointment.count()
    const newAppointments = await db.appointment.count({
      where: { createdAt: { gte: startDate } }
    })
    const completedAppointments = await db.appointment.count({
      where: { 
        createdAt: { gte: startDate },
        status: 'completed'
      }
    })

    // Get call logs
    const calls = await db.callLog.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        id: true,
        direction: true,
        status: true,
        duration: true,
        sentiment: true,
        intent: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const inboundCalls = calls.filter(c => c.direction === 'inbound').length
    const outboundCalls = calls.filter(c => c.direction === 'outbound').length
    const missedCalls = calls.filter(c => c.status === 'missed').length
    const avgCallDuration = calls.reduce((acc, c) => acc + (c.duration || 0), 0) / (calls.length || 1)

    // Get WhatsApp messages
    const whatsappMessages = await db.whatsAppMessage.count({
      where: { createdAt: { gte: startDate } }
    })

    // Get sentiment distribution
    const sentimentCounts = {
      positive: calls.filter(c => c.sentiment === 'positive').length,
      negative: calls.filter(c => c.sentiment === 'negative').length,
      neutral: calls.filter(c => c.sentiment === 'neutral').length,
    }

    // Get intent distribution
    const intentCounts: Record<string, number> = {}
    calls.forEach(c => {
      if (c.intent) {
        intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1
      }
    })

    // Get conversation stats
    const conversations = await db.conversation.count({
      where: { createdAt: { gte: startDate } }
    })
    const resolvedConversations = await db.conversation.count({
      where: { 
        createdAt: { gte: startDate },
        status: 'resolved'
      }
    })

    // Get lead scores distribution
    const contacts = await db.contact.findMany({
      where: { createdAt: { gte: startDate } },
      select: { status: true },
    })

    const leadDistribution = {
      lead: contacts.filter(c => c.status === 'lead').length,
      prospect: contacts.filter(c => c.status === 'prospect').length,
      customer: contacts.filter(c => c.status === 'customer').length,
    }

    // Calculate hourly distribution for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCalls = await db.callLog.findMany({
      where: { createdAt: { gte: today } },
      select: { createdAt: true },
    })

    const hourlyDistribution: Record<number, number> = {}
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0
    }
    todayCalls.forEach(c => {
      const hour = c.createdAt.getHours()
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1
    })

    // Calculate metrics
    const responseRate = calls.length > 0 
      ? ((calls.length - missedCalls) / calls.length * 100).toFixed(1)
      : 100

    const conversionRate = newContacts > 0
      ? (leadDistribution.customer / newContacts * 100).toFixed(1)
      : 0

    return NextResponse.json({
      period,
      summary: {
        totalContacts,
        newContacts,
        totalAppointments,
        newAppointments,
        completedAppointments,
        inboundCalls,
        outboundCalls,
        missedCalls,
        avgCallDuration: Math.round(avgCallDuration),
        whatsappMessages,
        conversations,
        resolvedConversations,
      },
      sentiment: sentimentCounts,
      intents: intentCounts,
      leadDistribution,
      hourlyDistribution,
      metrics: {
        responseRate,
        conversionRate,
        satisfactionRate: sentimentCounts.positive / (calls.length || 1) * 100,
      },
      recentCalls: calls.slice(0, 10),
    })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
