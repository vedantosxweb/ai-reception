/**
 * Chat API - Production Ready
 * Conversation memory persisted in DB, user linked to Contact on booking
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateResponse, getConversation, clearConversation } from '@/lib/ai'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

async function checkAvailability(date: string) {
  const s = new Date(date); s.setHours(0,0,0,0)
  const e = new Date(date); e.setHours(23,59,59,999)
  const apts = await db.appointment.findMany({ where: { startTime: { gte: s, lte: e }, status: { not: 'cancelled' } } })
  const booked = apts.map(a => a.startTime.getHours())
  const slots: string[] = []
  for (let h = 9; h < 17; h++) if (!booked.includes(h)) slots.push(`${h}:00`)
  return { available: slots.length > 0, slots }
}

async function createBooking(data: { name: string; email?: string; phone?: string; date: string; time: string; serviceName?: string }) {
  try {
    const d = new Date(data.date)
    const [h, m] = data.time.split(':').map(Number)
    d.setHours(h, m, 0, 0)
    const end = new Date(d); end.setMinutes(end.getMinutes() + 30)

    const conflict = await db.appointment.findFirst({ where: { startTime: { lt: end }, endTime: { gt: d }, status: { not: 'cancelled' } } })
    if (conflict) return { success: false, message: 'That time slot is already booked. Please choose a different time.' }

    // Find or create contact — prefer email lookup, fallback to phone
    let contact = null
    if (data.email) contact = await db.contact.findFirst({ where: { email: data.email.toLowerCase() } })
    if (!contact && data.phone) contact = await db.contact.findFirst({ where: { phone: data.phone } })
    if (!contact) {
      const parts = data.name.split(' ')
      contact = await db.contact.create({ data: {
        firstName: parts[0] || data.name, lastName: parts.slice(1).join(' ') || '',
        email: data.email?.toLowerCase() || null, phone: data.phone || null,
        source: 'chat', status: 'lead', lastContact: new Date(),
      }})
    } else {
      // Update lastContact
      await db.contact.update({ where: { id: contact.id }, data: { lastContact: new Date(), status: contact.status === 'lead' ? 'prospect' : contact.status } })
    }

    const apt = await db.appointment.create({ data: {
      contactId: contact.id, title: data.serviceName || `Appointment with ${data.name}`,
      startTime: d, endTime: end, status: 'scheduled', source: 'chat',
    }, include: { contact: true } })

    return { success: true, message: `✅ Your appointment is confirmed for ${d.toLocaleDateString()} at ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}. We look forward to seeing you!`, appointment: { id: apt.id, date: apt.startTime, contact: `${apt.contact.firstName} ${apt.contact.lastName}` } }
  } catch (err) {
    console.error('Booking error:', err)
    return { success: false, message: 'Sorry, I could not complete the booking. Please try again.' }
  }
}

async function hydrateConversation(sessionId: string, channel: 'chat' | 'voice' | 'whatsapp') {
  const ctx = getConversation(sessionId, channel)
  if (ctx.history.length === 0) {
    try {
      const msgs = await db.message.findMany({ where: { conversationId: sessionId }, orderBy: { createdAt: 'asc' }, take: 20 })
      if (msgs.length > 0) {
        ctx.history = msgs.map(m => ({ role: m.role as 'user'|'assistant'|'system', content: m.content, timestamp: m.createdAt }))
        const last = msgs.filter(m => m.metadata).pop()
        if (last?.metadata) { try { const p = JSON.parse(last.metadata); if (p.bookingData) ctx.metadata = { ...ctx.metadata, bookingData: p.bookingData } } catch {} }
      }
    } catch {}
  }
  return ctx
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, bookingData } = await req.json()
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Message is required' }, { status: 400 })

    // Get logged-in user for auto-filling contact info
    const authUser = await getAuthUser()
    const conversationId = sessionId || `chat_${Date.now()}`
    const ctx = await hydrateConversation(conversationId, 'chat')

    // Pre-fill booking data with logged-in user's info
    if (authUser && ctx.metadata?.bookingData && !ctx.metadata.bookingData.name) {
      ctx.metadata.bookingData.name = authUser.name
    }

    let businessContext = {}
    try {
      const settings = await db.systemSetting.findMany({ where: { category: 'general' } })
      const s: Record<string, string> = {}; settings.forEach(x => { s[x.key] = x.value })
      businessContext = { businessName: s.businessName || 'Our Business', businessHours: s.businessHours || 'Monday-Friday, 9 AM - 5 PM', services: s.services?.split(',').map(x => x.trim()) || ['Consultation', 'Support', 'Demo'] }
    } catch {}

    // Handle explicit booking submission
    if (bookingData?.name && bookingData?.date && bookingData?.time) {
      // Auto-fill email from logged-in user
      const enrichedBooking = { ...bookingData, email: bookingData.email || (authUser?.role === 'user' ? authUser.email : undefined) }
      const result = await createBooking(enrichedBooking)
      return NextResponse.json({ response: result.message, intent: result.success ? 'booking_confirmed' : 'booking_failed', sentiment: result.success ? 'positive' : 'neutral', confidence: 0.95, booking: result.appointment, timestamp: new Date().toISOString() })
    }

    // Availability check shortcut
    const lower = message.toLowerCase()
    if (lower.includes('available') || lower.includes('slots') || lower.includes('times')) {
      const days = []
      for (let i = 1; i <= 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i)
        const str = d.toISOString().split('T')[0]
        const { available, slots } = await checkAvailability(str)
        if (available) days.push({ date: str, day: d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}), slots })
      }
      if (days.length > 0) {
        const txt = days.slice(0,3).map(d => `${d.day}: ${d.slots.slice(0,4).join(', ')}`).join('\n')
        return NextResponse.json({ response: `Here are our available time slots:\n\n${txt}\n\nWhich time works best for you?`, intent: 'availability_check', sentiment: 'positive', confidence: 0.95, availableSlots: days, timestamp: new Date().toISOString() })
      }
    }

    const t0 = Date.now()
    const response = await generateResponse(message, ctx, businessContext)
    const latency = Date.now() - t0

    // Persist conversation + messages
    try {
      await db.conversation.upsert({ where: { id: conversationId }, create: { id: conversationId, channel: 'chat', intent: response.intent, sentiment: response.sentiment }, update: { intent: response.intent, sentiment: response.sentiment, updatedAt: new Date() } })
      const meta = ctx.metadata?.bookingData ? JSON.stringify({ bookingData: ctx.metadata.bookingData }) : null
      await db.message.createMany({ data: [
        { conversationId, role: 'user', content: message, messageType: 'text' },
        { conversationId, role: 'assistant', content: response.text, messageType: 'text', latency, metadata: meta },
      ]})
    } catch (e) { console.error('Persist error:', e) }

    return NextResponse.json({ response: response.text, intent: response.intent, sentiment: response.sentiment, confidence: response.confidence, leadScore: response.leadScore, shouldEscalate: response.shouldEscalate, latency, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('Chat API Error:', err)
    return NextResponse.json({ error: 'Failed to process message', response: 'I apologize, but I encountered an error. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (sessionId) {
    clearConversation(sessionId)
    try { await db.conversation.update({ where: { id: sessionId }, data: { status: 'resolved' } }) } catch {}
  }
  return NextResponse.json({ success: true })
}
