import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role, businessName, phone } = await req.json()

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'Email, password, name and role are required' }, { status: 400 })
    }
    if (!['host', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Role must be host or user' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashPassword(password),
        role,
        businessName: role === 'host' ? businessName : null,
        phone: phone || null,
        status: 'active',
      },
    })

    const token = createToken({ id: user.id, email: user.email, role: user.role, name: user.name })
    await setAuthCookie(token)

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, businessName: user.businessName },
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
