/**
 * Twilio SMS Webhook Handler
 * Handles incoming SMS messages with AI responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateResponse, getConversation, getBookingData } from '@/lib/ai'
import { db } from '@/lib/db'
import { sendSMS } from '@/lib/twilio'

// Active SMS sessions
const smsSessions = new Map<string, {
  phoneNumber: string
  lastMessage: Date
  messageCount: number
}>()

/**
 * POST handler for incoming SMS
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const data = Object.fromEntries(formData.entries())

    const from = data.From as string
    const to = data.To as string
    const body = data.Body as string
    const messageSid = data.MessageSid as string

    console.log('📱 SMS received:', { from, body: body.substring(0, 50) })

    // Get or create session
    let session = smsSessions.get(from)
    if (!session) {
      session = {
        phoneNumber: from,
        lastMessage: new Date(),
        messageCount: 0,
      }
      smsSessions.set(from, session)
    }
    session.messageCount++
    session.lastMessage = new Date()

    // Find or create contact
    let contactId: string | undefined
    try {
      const contact = await db.contact.upsert({
        where: { phone: from },
        create: {
          firstName: 'SMS',
          lastName: 'Contact',
          phone: from,
          source: 'sms',
          status: 'lead',
        },
        update: {
          lastContact: new Date(),
        },
      })
      contactId = contact.id
    } catch (error) {
      console.error('Error with contact:', error)
    }

    // Get conversation context
    const context = getConversation(`sms_${from}`, 'whatsapp')
    context.metadata = { phoneNumber: from, contactId }

    // Generate AI response
    const response = await generateResponse(body, context)

    console.log('🤖 SMS AI Response:', response.text.substring(0, 100))

    // Check if booking is complete
    const bookingData = getBookingData(`sms_${from}`)
    if (response.bookingComplete && bookingData && contactId) {
      // Create appointment
      try {
        const appointmentDate = new Date(bookingData.date || '')
        if (bookingData.time) {
          const [hours, minutes] = bookingData.time.split(':').map(Number)
          appointmentDate.setHours(hours, minutes, 0, 0)
        }

        await db.appointment.create({
          data: {
            contactId,
            title: bookingData.service || 'SMS Booking',
            startTime: appointmentDate,
            endTime: new Date(appointmentDate.getTime() + 30 * 60 * 1000),
            status: 'scheduled',
            source: 'sms',
            notes: `Name: ${bookingData.name}, Phone: ${bookingData.phone}, Email: ${bookingData.email}`,
          },
        })
        console.log('✅ Appointment created via SMS')
      } catch (error) {
        console.error('Error creating appointment:', error)
      }
    }

    // Store message in database
    try {
      await db.message.create({
        data: {
          conversationId: `sms_${from}`,
          role: 'user',
          content: body,
          messageType: 'text',
        },
      })
      await db.message.create({
        data: {
          conversationId: `sms_${from}`,
          role: 'assistant',
          content: response.text,
          messageType: 'text',
        },
      })
    } catch (error) {
      console.error('Error storing messages:', error)
    }

    // Send SMS response
    const smsResult = await sendSMS(from, response.text)
    
    if (!smsResult.success) {
      console.error('Failed to send SMS:', smsResult.error)
    }

    // Return empty TwiML (we handle the response separately)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'application/xml' },
    })
  } catch (error) {
    console.error('❌ SMS webhook error:', error)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'application/xml' },
    })
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  
  // Twilio webhook verification
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  
  if (mode === 'subscribe' && challenge) {
    return new NextResponse(challenge)
  }

  return NextResponse.json({ status: 'ok', type: 'sms' })
}
