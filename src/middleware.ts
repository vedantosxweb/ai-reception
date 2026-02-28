import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-edge'

const PUBLIC_PATHS = ['/auth', '/api/auth/login', '/api/auth/signup', '/api/twilio']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Skip static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('ar_token')?.value
  const payload = token ? await verifyToken(token) : null

  // Not authenticated → go to /auth
  if (!payload) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // Already authenticated, trying to go to /auth → redirect to home
  if (pathname === '/auth') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
