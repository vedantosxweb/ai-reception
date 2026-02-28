/**
 * WhatsApp Business API Webhook Handler
 * Handles incoming WhatsApp messages and manages conversations
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  sendWhatsAppMessage,
  verifyWebhook,
  parseWhatsAppWebhook,
  markMessageAsRead,
} from '@/lib/whatsapp'
import { generateResponse, getConversation } from '@/lib/ai'
import { db } from '@/lib/db'

/**
 * GET - Webhook verification
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('WhatsApp webhook verification:', { mode, token, challenge })

  // Verify webhook
  const result = verifyWebhook(mode || '', token || '', challenge || '')

  if (result) {
    console.log('WhatsApp webhook verified successfully')
    return new NextResponse(result, { status: 200 })
  }

  console.log('WhatsApp webhook verification failed')
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST - Handle incoming messages
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2))

    // Parse incoming messages
    const messages = parseWhatsAppWebhook(body)

    if (messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' }, { status: 200 })
    }

    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message)
    }

    return NextResponse.json({ status: 'success' }, { status: 200 })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Process incoming WhatsApp message
 */
async function processIncomingMessage(message: {
  from: string
  messageId: string
  timestamp: string
  type: string
  text?: string
  imageId?: string
  audioId?: string
  documentId?: string
}) {
  const { from, messageId, type, text, imageId, audioId } = message

  console.log(`Processing message from ${from}:`, { type, text })

  // Mark message as read
  await markMessageAsRead(messageId)

  // Get or create contact
  let contact
  try {
    contact = await db.contact.upsert({
      where: { phone: from },
      create: {
        firstName: 'WhatsApp',
        lastName: 'Contact',
        phone: from,
        source: 'whatsapp',
        status: 'lead',
        lastContact: new Date(),
      },
      update: {
        lastContact: new Date(),
      },
    })
  } catch (error) {
    console.error('Error creating contact:', error)
  }

  // Get or create WhatsApp session
  try {
    await db.whatsAppSession.upsert({
      where: { phoneNumber: from },
      create: {
        phoneNumber: from,
        contactId: contact?.id,
        status: 'active',
        lastMessage: new Date(),
      },
      update: {
        lastMessage: new Date(),
      },
    })
  } catch (error) {
    console.error('Error creating WhatsApp session:', error)
  }

  // Store incoming message
  try {
    await db.whatsAppMessage.create({
      data: {
        sessionId: from,
        direction: 'inbound',
        content: text || `[${type}]`,
        messageType: type,
        status: 'read',
      },
    })
  } catch (error) {
    console.error('Error storing message:', error)
  }

  // Handle different message types
  if (type === 'text' && text) {
    await handleTextMessage(from, text, contact?.id)
  } else if (type === 'audio' && audioId) {
    await handleAudioMessage(from, audioId, contact?.id)
  } else if (type === 'image' && imageId) {
    await handleImageMessage(from, imageId, contact?.id)
  } else {
    await sendWhatsAppMessage(
      from,
      'Thank you for your message. A team member will respond shortly.'
    )
  }
}

/**
 * Handle text message
 */
async function handleTextMessage(
  from: string,
  text: string,
  contactId?: string
) {
  // Get conversation context
  const context = getConversation(from, 'whatsapp')
  context.metadata = {
    ...context.metadata,
    phoneNumber: from,
    contactId,
  }

  // Generate AI response
  const response = await generateResponse(text, context)

  // Send response
  await sendWhatsAppMessage(from, response.text)

  // Store outgoing message
  try {
    await db.whatsAppMessage.create({
      data: {
        sessionId: from,
        direction: 'outbound',
        content: response.text,
        messageType: 'text',
        status: 'sent',
      },
    })
  } catch (error) {
    console.error('Error storing outgoing message:', error)
  }

  // Handle booking intent
  if (response.intent === 'booking' && response.actions?.length && contactId) {
    try {
      await db.appointment.create({
        data: {
          contactId,
          title: 'WhatsApp Booking Request',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          status: 'pending',
          source: 'whatsapp',
          notes: `Booking request: ${JSON.stringify(response.actions[0].data)}`,
        },
      })
    } catch (error) {
      console.error('Error creating appointment:', error)
    }
  }

  // Handle high-value leads
  if (response.leadScore && response.leadScore >= 80) {
    console.log(`High-value lead detected: ${from} (Score: ${response.leadScore})`)
  }

  // Handle escalation
  if (response.shouldEscalate) {
    await sendWhatsAppMessage(
      from,
      'I\'ve notified our team. They will reach out to you shortly.'
    )
  }

  // Update contact if lead score is high
  if (contactId && response.leadScore && response.leadScore >= 70) {
    try {
      await db.contact.update({
        where: { id: contactId },
        data: { status: 'prospect' },
      })
    } catch (error) {
      console.error('Error updating contact status:', error)
    }
  }
}

/**
 * Handle audio message
 */
async function handleAudioMessage(from: string, audioId: string, contactId?: string) {
  await sendWhatsAppMessage(
    from,
    'I received your voice message. Voice messages are best handled over a phone call. Would you like me to call you back?'
  )

  try {
    await db.whatsAppMessage.create({
      data: {
        sessionId: from,
        direction: 'inbound',
        content: `[Voice Message: ${audioId}]`,
        messageType: 'audio',
        status: 'read',
      },
    })
  } catch (error) {
    console.error('Error storing audio message:', error)
  }
}

/**
 * Handle image message
 */
async function handleImageMessage(from: string, imageId: string, contactId?: string) {
  await sendWhatsAppMessage(
    from,
    'Thank you for sharing the image. Our team will review it and get back to you.'
  )

  try {
    await db.whatsAppMessage.create({
      data: {
        sessionId: from,
        direction: 'inbound',
        content: `[Image: ${imageId}]`,
        messageType: 'image',
        status: 'read',
      },
    })
  } catch (error) {
    console.error('Error storing image message:', error)
  }
}
