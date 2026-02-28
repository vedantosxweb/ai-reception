import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const where: Record<string, unknown> = {}
    if (search) where.OR = [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { company: { contains: search, mode: 'insensitive' } }]
    if (status) where.status = status
    const contacts = await db.contact.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { appointments: true, conversations: true } } } })
    return NextResponse.json({ contacts })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, phone, company, position, source, notes } = body
    if (!firstName || !lastName) return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
    // Check for duplicate email
    if (email) {
      const existing = await db.contact.findFirst({ where: { email: email.toLowerCase() } })
      if (existing) return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
    }
    const contact = await db.contact.create({ data: { firstName, lastName, email: email?.toLowerCase() || null, phone: phone || null, company: company || null, position: position || null, source: source || 'manual', notes: notes || null, status: 'lead', lastContact: new Date() } })
    return NextResponse.json({ contact, success: true })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...data } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const contact = await db.contact.update({ where: { id }, data })
    return NextResponse.json({ contact, success: true })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await db.contact.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) { console.error(err); return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 }) }
}
