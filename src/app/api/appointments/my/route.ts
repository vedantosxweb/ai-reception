import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ appointments: [] })
  try {
    const contact = await db.contact.findFirst({ where: { email: email.toLowerCase() } })
    if (!contact) return NextResponse.json({ appointments: [] })
    const appointments = await db.appointment.findMany({
      where: { contactId: contact.id },
      orderBy: { startTime: 'desc' },
      include: { service: { select: { name: true } } },
      take: 20,
    })
    return NextResponse.json({ appointments })
  } catch {
    return NextResponse.json({ appointments: [] })
  }
}
