import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url)

  // SEC-01: API Rate Limiting for v1 routes
  if (url.pathname.startsWith('/api/v1')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'anonymous'
    const identifier = (await auth()).userId || ip
    const result = await checkRateLimit(`api_${identifier}`)

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: result.resetAt },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetAt.toString(),
          }
        }
      )
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
