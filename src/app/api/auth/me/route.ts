import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getAuthUser()
    if (!payload) return NextResponse.json({ user: null }, { status: 401 })

    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, businessName: true, phone: true, avatar: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ user: null }, { status: 401 })

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
