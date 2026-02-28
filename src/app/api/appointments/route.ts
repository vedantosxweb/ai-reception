import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - List all appointments
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const contactId = searchParams.get('contactId')

    const where: Record<string, unknown> = {}
    
    if (status) {
      where.status = status
    }
    
    if (date) {
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)
      
      where.startTime = {
        gte: startDate,
        lte: endDate
      }
    }
    
    if (contactId) {
      where.contactId = contactId
    }

    const appointments = await db.appointment.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        service: true,
        staff: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

// POST - Create a new appointment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contactId, serviceId, staffId, title, description, startTime, endTime, source, notes } = body

    if (!contactId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Contact, title, start time, and end time are required' },
        { status: 400 }
      )
    }

    const appointment = await db.appointment.create({
      data: {
        contactId,
        serviceId,
        staffId,
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        source: source || 'manual',
        notes,
        status: 'scheduled'
      },
      include: {
        contact: true,
        service: true
      }
    })

    return NextResponse.json({ appointment, success: true })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    )
  }
}

// PATCH - Update appointment status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Appointment ID and status are required' },
        { status: 400 }
      )
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: { status }
    })

    return NextResponse.json({ appointment, success: true })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    )
  }
}
