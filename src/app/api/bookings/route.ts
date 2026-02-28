/**
 * Booking API
 * Handles appointment creation, conflict checking, and availability
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Check availability for a date
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  
  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const appointments = await db.appointment.findMany({
      where: {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'cancelled',
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    // Generate available slots (9 AM - 5 PM, 30 min slots)
    const availableSlots = []
    const bookedSlots = appointments.map(apt => ({
      start: apt.startTime,
      end: apt.endTime,
    }))

    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(date)
        slotStart.setHours(hour, minute, 0, 0)
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + 30)

        // Check if slot is booked
        const isBooked = bookedSlots.some(
          booked => slotStart >= booked.start && slotStart < booked.end
        )

        if (slotStart > new Date()) {
          availableSlots.push({
            time: slotStart.toISOString(),
            display: `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`,
            available: !isBooked,
          })
        }
      }
    }

    return NextResponse.json({
      date,
      appointments: appointments.map(apt => ({
        id: apt.id,
        title: apt.title,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
      })),
      availableSlots,
    })
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 })
  }
}

// POST - Create a new appointment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, date, time, serviceName, notes } = body

    if (!name || !date || !time) {
      return NextResponse.json(
        { error: 'Name, date, and time are required' },
        { status: 400 }
      )
    }

    // Parse date and time
    const appointmentDate = new Date(date)
    const [hours, minutes] = time.split(':').map(Number)
    appointmentDate.setHours(hours, minutes, 0, 0)

    const endTime = new Date(appointmentDate)
    endTime.setMinutes(endTime.getMinutes() + 30) // Default 30 min

    // Check for conflicts
    const conflictingAppointment = await db.appointment.findFirst({
      where: {
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: appointmentDate,
        },
        status: {
          not: 'cancelled',
        },
      },
    })

    if (conflictingAppointment) {
      return NextResponse.json({
        success: false,
        error: 'TIME_SLOT_BOOKED',
        message: 'This time slot is already booked. Please choose another time.',
        conflictingSlot: {
          start: conflictingAppointment.startTime,
          end: conflictingAppointment.endTime,
        },
      }, { status: 409 })
    }

    // Find or create contact
    let contact = null
    if (email) {
      contact = await db.contact.findFirst({
        where: { email },
      })
    }

    if (!contact) {
      const nameParts = name.split(' ')
      contact = await db.contact.create({
        data: {
          firstName: nameParts[0] || name,
          lastName: nameParts.slice(1).join(' ') || '',
          email: email || null,
          phone: phone || null,
          source: 'chat',
          status: 'lead',
        },
      })
    }

    // Find service
    let service = null
    if (serviceName) {
      service = await db.service.findFirst({
        where: {
          name: { contains: serviceName, mode: 'insensitive' },
          active: true,
        },
      })
    }

    // Create appointment
    const appointment = await db.appointment.create({
      data: {
        contactId: contact.id,
        serviceId: service?.id || null,
        title: serviceName || `Appointment with ${name}`,
        startTime: appointmentDate,
        endTime: endTime,
        status: 'scheduled',
        source: 'chat',
        notes: notes || null,
      },
      include: {
        contact: true,
        service: true,
      },
    })

    console.log('[Booking] Created appointment:', appointment.id)

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        title: appointment.title,
        date: appointment.startTime.toISOString(),
        time: appointment.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contact: {
          name: `${appointment.contact.firstName} ${appointment.contact.lastName}`,
          email: appointment.contact.email,
          phone: appointment.contact.phone,
        },
        status: appointment.status,
      },
    })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
  }
}

// DELETE - Cancel an appointment
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
  }

  try {
    await db.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    return NextResponse.json({ success: true, message: 'Appointment cancelled' })
  } catch (error) {
    console.error('Error cancelling appointment:', error)
    return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 })
  }
}
