import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks/(.*)',   // Twilio/Clerk webhooks
  '/api/v1/health',       // Health check
  '/api/cron/(.*)',       // Cron jobs
])

export default clerkMiddleware(async (auth, req) => {
  // Don't protect public routes (webhooks, health checks, landing page)
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
