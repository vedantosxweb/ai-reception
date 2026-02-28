/**
 * Twilio Status Callback Endpoint
 * Handles call status updates from Twilio
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const data = Object.fromEntries(formData.entries())

    const callSid = data.CallSid as string
    const callStatus = data.CallStatus as string
    const callDuration = data.CallDuration as string
    const from = data.From as string
    const to = data.To as string
    const direction = data.Direction as string

    console.log('📞 Call Status Update:', {
      callSid,
      status: callStatus,
      duration: callDuration,
      from,
      to,
      direction,
    })

    // Update call log in database
    try {
      await db.callLog.update({
        where: { id: callSid },
        data: {
          status: callStatus,
          duration: callDuration ? parseInt(callDuration) : undefined,
        },
      })
    } catch (error) {
      console.error('Error updating call log:', error)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Status callback error:', error)
    return NextResponse.json({ received: true })
  }
}
