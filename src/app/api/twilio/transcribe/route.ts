/**
 * Twilio Transcribe Callback
 * Handles transcription results from Twilio
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const data = Object.fromEntries(formData.entries())

    const callSid = data.CallSid as string
    const transcriptionText = data.TranscriptionText as string
    const transcriptionStatus = data.TranscriptionStatus as string
    const recordingUrl = data.RecordingUrl as string

    console.log('📝 Transcription received:', {
      callSid,
      status: transcriptionStatus,
      text: transcriptionText?.substring(0, 100),
    })

    // Update call log with transcript
    if (transcriptionStatus === 'completed' && transcriptionText) {
      try {
        await db.callLog.update({
          where: { id: callSid },
          data: {
            transcript: transcriptionText,
            recording: recordingUrl,
          },
        })
      } catch (error) {
        console.error('Error updating call transcript:', error)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Transcribe callback error:', error)
    return NextResponse.json({ received: true })
  }
}
