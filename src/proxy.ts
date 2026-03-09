import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAuthSecret } from '@/lib/auth-env';

const AUTH_PAGES = ['/login', '/signup'] as const;
const PROTECTED_PAGES = ['/dashboard', '/onboarding'] as const;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authSecret = getAuthSecret();

  // Skip static assets and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/assets')
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: authSecret || undefined });
  const isAuthed = Boolean(token?.sub);

  // Redirect authenticated users away from auth pages
  if (isAuthed && AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Protect app pages (API routes are already protected server-side)
  if (!isAuthed && PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * App pages
     */
    '/login',
    '/signup',
    '/dashboard/:path*',
    '/onboarding/:path*',
  ],
};
