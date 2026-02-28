/**
 * Outbound Call API
 * Make outbound calls from the dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER

function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return null
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

/**
 * POST - Make an outbound call
 */
export async function POST(req: NextRequest) {
  try {
    const { to, message, contactId } = await req.json()

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const client = getTwilioClient()
    if (!client) {
      return NextResponse.json(
        { error: 'Twilio is not configured' },
        { status: 503 }
      )
    }

    // Create TwiML for the call
    const VoiceResponse = twilio.twiml.VoiceResponse
    const twiml = new VoiceResponse()
    
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US',
    }, message || 'Hello, this is a call from AI Receptionist.')

    twiml.gather({
      input: 'speech dtmf',
      speechTimeout: 'auto',
      action: `/api/twilio/voice?contactId=${contactId || ''}`,
    })

    // Make the call
    const call = await client.calls.create({
      to,
      from: TWILIO_PHONE_NUMBER!,
      twiml: twiml.toString(),
      statusCallback: `/api/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    })

    // Create call log
    try {
      const { db } = await import('@/lib/db')
      await db.callLog.create({
        data: {
          id: call.sid,
          phoneNumber: to,
          direction: 'outbound',
          status: 'ringing',
          contactId,
        },
      })
    } catch (error) {
      console.error('Error creating call log:', error)
    }

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
    })
  } catch (error) {
    console.error('Error making outbound call:', error)
    return NextResponse.json(
      { error: 'Failed to make call', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * GET - Get call status
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const callSid = searchParams.get('callSid')

  if (!callSid) {
    return NextResponse.json(
      { error: 'Call SID is required' },
      { status: 400 }
    )
  }

  const client = getTwilioClient()
  if (!client) {
    return NextResponse.json(
      { error: 'Twilio is not configured' },
      { status: 503 }
    )
  }

  try {
    const call = await client.calls(callSid).fetch()
    
    return NextResponse.json({
      sid: call.sid,
      status: call.status,
      direction: call.direction,
      from: call.from,
      to: call.to,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    })
  } catch (error) {
    console.error('Error fetching call:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call status' },
      { status: 500 }
    )
  }
}
