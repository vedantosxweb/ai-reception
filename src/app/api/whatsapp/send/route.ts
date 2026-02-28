/**
 * WhatsApp Send Message API
 * Allows sending WhatsApp messages from the dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/whatsapp'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, message, templateName, templateParams, contactId } = body

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    let result

    if (templateName) {
      // Send template message
      result = await sendWhatsAppTemplate(
        to,
        templateName,
        'en',
        templateParams ? [{ type: 'body', parameters: templateParams.map((p: string) => ({ type: 'text', text: p })) }] : undefined
      )
    } else if (message) {
      // Send text message
      result = await sendWhatsAppMessage(to, message)
    } else {
      return NextResponse.json(
        { error: 'Message or template name is required' },
        { status: 400 }
      )
    }

    // Store message in database
    if (result.success && message) {
      try {
        await db.whatsAppMessage.create({
          data: {
            sessionId: to,
            direction: 'outbound',
            content: message,
            messageType: 'text',
            status: 'sent',
          },
        })
      } catch (error) {
        console.error('Error storing message:', error)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
