/**
 * Leads API
 * Manages lead scoring and lead management
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List leads with filtering and scoring
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const minScore = searchParams.get('minScore')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (source) {
      where.source = source
    }

    // Get contacts with their conversation data
    const contacts = await db.contact.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            appointments: true,
            conversations: true,
          }
        },
        appointments: {
          where: { status: 'completed' },
          select: { id: true },
        },
      },
    })

    // Calculate lead scores
    const leads = contacts.map(contact => {
      let score = 30 // Base score

      // Engagement points
      score += contact._count.conversations * 5
      score += contact._count.appointments * 10
      score += contact.appointments.length * 15

      // Status points
      if (contact.status === 'customer') score += 30
      else if (contact.status === 'prospect') score += 15

      // Source points
      if (contact.source === 'referral') score += 20
      else if (contact.source === 'website') score += 10

      // Recency points
      if (contact.lastContact) {
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(contact.lastContact).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceContact < 7) score += 10
        else if (daysSinceContact < 30) score += 5
      }

      // Cap at 100
      score = Math.min(100, score)

      return {
        ...contact,
        leadScore: score,
        engagementLevel: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
      }
    })

    // Filter by minimum score if specified
    const filteredLeads = minScore
      ? leads.filter(l => l.leadScore >= parseInt(minScore))
      : leads

    return NextResponse.json({
      leads: filteredLeads,
      total: filteredLeads.length,
      summary: {
        high: leads.filter(l => l.leadScore >= 70).length,
        medium: leads.filter(l => l.leadScore >= 40 && l.leadScore < 70).length,
        low: leads.filter(l => l.leadScore < 40).length,
      },
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

// PATCH - Update lead status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    const contact = await db.contact.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes && { notes }),
      },
    })

    return NextResponse.json({ contact, success: true })
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}
