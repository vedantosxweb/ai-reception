# Production Fixes & Changelog

## Session 2 — Full Pre-Launch Audit (March 2026)

### 🛡️ Agent Booking Rules (New Feature)
Inspired by smart-scheduling best practices, the AI agent now enforces:

1. **Always check availability before booking** — AI emits `[CHECK_AVAILABILITY:date=...|time=...]` marker; the system resolves it against the DB (+ Google Calendar) before the caller hears a confirmation.
2. **If unavailable, provide 3 closest alternatives** — System finds the 3 nearest free slots on that day, passes them back to the AI, which offers them naturally to the caller.
3. **If available, confirm booking** — AI receives `SLOT_AVAILABLE` message, confirms with caller, then emits `[BOOKING:...]`.
4. **Double-check on final booking** — A race-condition guard runs a conflict check again at the moment of `[BOOKING:...]` confirmation. If the slot was just taken, the AI re-offers alternatives without losing the call.
5. **Meeting duration fully customizable** — No hardcoded 30-minute default. Each tenant sets their default in Settings → Meeting Slot Settings. All scheduling logic reads from `tenant.defaultMeetingDurationMinutes`.

### 🔴 Critical Bug Fixes

**Schema**
- `PasswordResetToken` was missing the `User` FK relation — Prisma queries using `db.passwordResetToken` would fail silently or throw at runtime. Fixed: added `user User @relation(...)` and back-relation `passwordResetTokens PasswordResetToken[]` on `User`.
- Same fix applied to `EmailVerificationToken`.

**Redis / In-Memory Fallback**
- App would crash on startup if `REDIS_URL` was not set — now gracefully falls back to in-memory store (Map-based). All call sessions, AI sessions, and rate limiting work without Redis.

**Registration API** (`/api/auth/register`)
- No rate limiting — could be abused to create unlimited tenants. Fixed: 10 req/hr per IP.
- No Zod validation — raw body was parsed without schema. Fixed: uses `registrationSchema`.

**Appointments API**
- Duration defaulted to hardcoded `60` when not passed — should use tenant's `defaultMeetingDurationMinutes`. Fixed.

**AI System Prompt**
- Old booking flow had no availability check — AI would immediately confirm a booking without checking if the slot was free. Completely rewritten with Rules 1–4.
- Booking markers (`[BOOKING:...]`, `[CHECK_AVAILABILITY:...]`) were not suppressed in voice TTS — callers would hear "bracket booking bracket". Added explicit `NEVER read out markers` instruction.

**Voice Webhook**
- `defaultMeetingDurationMinutes` was not passed to `buildReceptionistPrompt` — AI was using hardcoded defaults. Fixed.
- Tenant query was fetching entire tenant object with no `select` — narrowed to only needed fields.
- `createBookingFromVoice` had duplicated inline code across multiple branches — refactored into a shared helper.

**SMS Webhook**
- `channel` was hardcoded to `'sms'` in WhatsApp webhook — fixed to `'whatsapp'`.
- `defaultMeetingDurationMinutes` not passed to prompt in SMS/WhatsApp webhooks. Fixed.

**Frontend**
- `overview.tsx`, `receptionists.tsx`, `call-logs.tsx`, `onboarding/page.tsx` — all `catch(console.error)` were silently swallowing errors. Replaced with `toast.error(...)` in every case.
- Receptionists panel: `toggleStatus` had no error handling. Fixed with toast feedback.
- Onboarding: scrape and deploy errors were silent. Fixed.

### ✅ Previously Fixed (Session 1)
- Billing: upgrade button logic, portal silent failure, billing success toast, cancel subscription UI, overage warnings
- Auth: forgot/reset password routes switched to rate-limited `/api/v1/` versions
- Settings: save errors, blocked time formatting, end-time validation, industry dropdown
- Calendar: buffer time between meetings, customizable slot step
- Dashboard shell: Suspense wrapper, tab URL param handling
- New fields: `meetingBufferMinutes`, `slotStepMinutes`, `defaultMeetingDurationMinutes` on Tenant

### 🗄️ Database Migration

Run on deploy:
```bash
npx prisma migrate deploy
```
Or for development:
```bash
npx prisma db push
```

Migration file: `prisma/migrations/20240901_add_meeting_buffer/migration.sql`

Adds:
- `Tenant.meetingBufferMinutes` (default 0)
- `Tenant.slotStepMinutes` (default 15)
- `Tenant.defaultMeetingDurationMinutes` (default 30 — fully configurable per tenant)
- `PasswordResetToken` table + User FK
- `EmailVerificationToken` table + User FK

### 📁 Files Changed (Session 2)
- `prisma/schema.prisma` — PasswordResetToken + EmailVerificationToken FK relations
- `prisma/migrations/20240901_add_meeting_buffer/migration.sql` — updated with FK + token tables
- `src/lib/redis.ts` — in-memory fallback when REDIS_URL not set
- `src/lib/ai/index.ts` — new booking rules in system prompt + CHECK_AVAILABILITY extraction
- `src/types/index.ts` — `availabilityCheckRequest` added to AIResponse
- `src/app/api/auth/register/route.ts` — rate limiting + Zod validation
- `src/app/api/v1/appointments/route.ts` — duration uses tenant default not hardcoded 60
- `src/app/api/webhooks/twilio/voice/route.ts` — full availability check flow + alternatives
- `src/app/api/webhooks/twilio/sms/route.ts` — pass defaultMeetingDurationMinutes to prompt
- `src/app/api/webhooks/twilio/whatsapp/route.ts` — fix channel name + pass duration to prompt
- `src/components/dashboard/overview.tsx` — toast error handling
- `src/components/dashboard/receptionists.tsx` — toast error handling + create/toggle feedback
- `src/components/dashboard/call-logs.tsx` — toast error handling
- `src/app/onboarding/page.tsx` — toast error handling on scrape + deploy
