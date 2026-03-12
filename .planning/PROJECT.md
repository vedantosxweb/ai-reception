# Project Context: AI Receptionist SaaS Milestone

## Vision
This milestone expands the production multi-tenant AI Receptionist SaaS application by adding business execution infrastructure, intelligence and automation features, customer experience upgrades, and dashboard improvements. This is an additive milestone—existing Voice, SMS, WhatsApp, RAG, and analytics functionality must remain fully functional.

## Core Value
The primary goal is to provide tenants with a complete, self-serve telephony provisioning flow, advanced intelligent features (outbound, scheduling, spam blocking, sentiment escalation), and deep visibility into their receptionist's performance, all while keeping the platform stable and tightly integrated with existing tools (Next.js, Prisma, Twilio, Creem.io).

## Constraints & Rules
- **Billing:** Handled strictly by Creem.io. **DO NOT add or reference Stripe**.
- **Performance:** Hosted on Vercel. Keep all serverless function execution under 30 seconds.
- **Security:** All new DB models must use the existing `tenantId` row-level security pattern.
- **Routing:** All new API routes go under `/api/v1/`.
- **UI/UX:** All new panels must use the existing shadcn/ui + Tailwind dark theme design system.
- **Stability:** Do not break existing features. Only additive features, unless specifically fixing a bug.

## Requirements

### Validated (From Codebase Map)
- ✓ Next.js App Router structure with Prisma/PostgreSQL
- ✓ Twilio integrations for Voice, SMS, WhatsApp
- ✓ Clerk authentication and NextAuth.js
- ✓ RAG from knowledge base (OpenAI, Pinecone)
- ✓ Call logs and analytics dashboard foundation
- ✓ Background processing via BullMQ/Redis
- ✓ Creem.io billing foundation

### Active (This Milestone)

**1. Business Execution Infrastructure**
- [ ] **1.A Phone Number Provisioning Flow:** Add Twilio API search/purchase to dashboard; auto-configure webhooks for purchased numbers; bind to tenantId; handle release on downgrade; show status; improve BYON (Bring Your Own Number) UI limits.
- [ ] **1.B Tenant Onboarding Wizard:** Create a 4-step post-payment wizard (Company Info -> Create AI -> Provision Number -> Add Knowledge Base); mark complete in DB to skip on future logins.

**2. Intelligence & Automation Features**
- [ ] **2.A Outbound Engine:** Enable scheduled outbound calls, auto-triggered follow-ups for missed inbound calls, and automatic SMS summaries after calls.
- [ ] **2.B Call Scheduling:** Detect callback requests via AI, offer Google Calendar slots, store in `scheduledCalls` table, show dashboard panel, and send 15-minute SMS reminders.
- [ ] **2.C Spam Call Detection:** Block inbound calls against a community API (e.g., NumVerify) and tenant custom blocklist; log blocked calls; show count in metrics.
- [ ] **2.D Sentiment-Based Escalation:** Detect negative sentiment/escalation keywords during live calls; attempt transfer to configured number; send WhatsApp alert to owner if unanswered.
- [ ] **2.E Caller History & Memory:** Retrieve past caller profiles (`callerProfiles` table: phone, name, email, lastCallAt, notes) to provide context and personalization to the AI.
- [ ] **2.F Multilingual Auto-Detect:** Use Deepgram/Whisper to detect language in first spoken sentence; auto-switch AI response language; log detected language.
- [ ] **2.G FAQ Auto-Builder:** Weekly background job to analyze 7 days of transcripts, cluster common questions, and surface top 5 suggested entries for 1-click addition to knowledge base.

**3. Customer Experience Features**
- [ ] **3.A Custom Greeting Per Number:** Add DB field and AI hook for unique opening greetings per phone number (ideal for multi-line businesses).
- [ ] **3.B Do Not Disturb VIP Override:** Allow VIP numbers to bypass business hours restrictions or trigger special alerts; route non-VIP to voicemail after hours.
- [ ] **3.C Hold Music & Wait Time:** Play hold tone/music if AI processing takes >2s or during call transfers.
- [ ] **3.D Lead Capture Form:** AI collects name, email, intent for new callers; store in `leads` table; display in dashboard with CSV export; auto-sync to HubSpot if connected.

**4. Dashboard Improvements**
- [ ] **4.A Missed Call Alerts:** Real-time in-app, email, and/or WhatsApp alerts for failed/dropped/missed calls; highlight in red in UI.
- [ ] **4.B Export Call Logs:** CSV export from Call Logs panel with date range filtering.
- [ ] **4.C Search Call Transcripts:** Full-text keyword/number/intent search on the Call Logs panel with transcript highlighting.
- [ ] **4.D Receptionist Performance Score:** Display resolution rate, average duration, sentiment score, and total calls compared to previous periods for each agent.
- [ ] **4.E Email Digests:** Automated daily or weekly email digest (via Resend/Nodemailer) summarizing calls, intents, sentiment, and usage.

**5. Technical & Stability**
- [ ] **5.A End-to-End Tests:** Add E2E flows testing inbound webhook -> AI response -> call log creation.
- [ ] **5.B Database Indexes:** Add indexes on `tenantId`, `phoneNumber`, `createdAt` across high-query tables.
- [ ] **5.C Health Endpoint:** Add `/api/v1/health` checking DB, Redis, and Twilio status.
- [ ] **5.D Rate Limiting:** Rate limit knowledge base ingestion endpoints.
- [ ] **5.E Twilio Retry Logic:** Add exponential backoff retries on Twilio webhook failures.
- [ ] **5.F Idempotent Webhooks:** Ensure all Creem.io webhook event handlers are idempotent.

### Out of Scope
- Stripe integrations (Creem.io only).
- Non-Serverless background workers exceeding 30s limits (must use BullMQ/Redis for heavy tasks if needed to sidestep serverless limits).

---
*Last updated: 2026-03-12 after initialization*
