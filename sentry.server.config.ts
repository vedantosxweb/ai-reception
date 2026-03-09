import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance monitoring — sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send in development unless explicitly enabled
  enabled: process.env.NODE_ENV === "production" || !!process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV || "development",
});
