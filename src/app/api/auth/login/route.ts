import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Your account has been suspended' }, { status: 403 })
    }

    const token = createToken({ id: user.id, email: user.email, role: user.role, name: user.name })
    await setAuthCookie(token)

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, businessName: user.businessName },
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 })
  }
}
