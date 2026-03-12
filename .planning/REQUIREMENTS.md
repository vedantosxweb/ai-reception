# Requirements: AI Receptionist SaaS (Milestone 2)

**Defined:** 2026-03-12
**Core Value:** Provide tenants with self-serve telephony provisioning, advanced intelligent features (outbound, scheduling, spam blocking, sentiment), and deep visibility into their receptionist's performance.

## v1 Requirements

### Business Execution Infrastructure

- [ ] **BIZ-01**: Tenant can search and purchase an available local Twilio number from the dashboard.
- [ ] **BIZ-02**: Purchased numbers are automatically configured with production webhook URLs for Voice, SMS, and WhatsApp.
- [ ] **BIZ-03**: Phone numbers are bound to `tenantId` in the database.
- [ ] **BIZ-04**: Tenant can view the status of their phone numbers (pending, active, released).
- [ ] **BIZ-05**: System includes clear UI flows for bringing an external number (BYON).
- [ ] **BIZ-06**: New tenants are routed through a 4-step onboarding wizard post-payment.
- [ ] **BIZ-07**: Onboarding wizard records company info, creates the first AI, and provisions a number.

### Intelligence & Automation Features

- [ ] **AI-01**: System supports scheduling and triggering outbound calls to a specific number at a specific time.
- [ ] **AI-02**: System automatically triggers a follow-up outbound call (e.g., 10 mins) after a missed inbound call if enabled by tenant.
- [ ] **AI-03**: System sends an automatic SMS summary to the caller after every completed call using a tenant-defined template.
- [ ] **AI-04**: AI detects callback scheduling intents and offers available Google Calendar time slots.
- [ ] **AI-05**: Scheduled callbacks are stored in `scheduledCalls` table and displayed on the dashboard.
- [ ] **AI-06**: System sends a 15-minute SMS reminder before scheduled callbacks.
- [ ] **AI-07**: Inbound calls are checked against a community spam list and a tenant custom blocklist before AI answers.
- [ ] **AI-08**: System plays a rejection message, ends the call, and logs the blocked status for detected spam calls.
- [ ] **AI-09**: AI detects negative sentiment or escalation keywords during a live call.
- [ ] **AI-10**: System attempts live transfer to a configured escalation number upon sentiment trigger.
- [ ] **AI-11**: System sends a WhatsApp alert to the business owner if the escalation transfer is unanswered.
- [ ] **AI-12**: System retrieves caller history and last interaction summary for returning phone numbers to context-inject the AI prompt.
- [ ] **AI-13**: System auto-detects caller language via Deepgram/Whisper on the first spoken sentence and switches response language.
- [ ] **AI-14**: A weekly scheduled job analyzes transcripts to surface top 5 suggested FAQ entries to the tenant.

### Customer Experience Features

- [ ] **CX-01**: Tenant can configure a custom opening greeting per phone number.
- [ ] **CX-02**: Tenant can mark specific numbers as VIP to bypass Do Not Disturb business hours.
- [ ] **CX-03**: System plays hold music or a wait tone if AI processing requires >2 seconds, or during transfers.
- [ ] **CX-04**: AI attempts to capture Name, Email, and Intent for unrecognized new callers.
- [ ] **CX-05**: Captured lead data is stored in a `leads` table and exportable to CSV.
- [ ] **CX-06**: Captured leads auto-sync to HubSpot if integration is active.

### Dashboard Improvements

- [ ] **DASH-01**: Tenants receive real-time alerts (in-app, email, WhatsApp) for missed, failed, or dropped calls.
- [ ] **DASH-02**: Missed calls are visually highlighted in red within the call logs panel.
- [ ] **DASH-03**: Tenant can export call logs to CSV with date range filtering.
- [ ] **DASH-04**: Tenant can perform full-text search across all call transcripts.
- [ ] **DASH-05**: Formatted search results highlight the matching keyword in the transcript preview.
- [ ] **DASH-06**: Receptionists panel displays performance scores (resolution rate, avg duration, sentiment score).
- [ ] **DASH-07**: Tenant receives an automated daily or weekly email digest summarizing performance metrics.

### Technical & Stability

- [ ] **TECH-01**: Full end-to-end tests exist for the inbound webhook -> AI response -> call log flow.
- [ ] **TECH-02**: Database indexes applied to `tenantId`, `phoneNumber`, and `createdAt` on high-query tables.
- [ ] **TECH-03**: `/api/v1/health` endpoint checks database, Redis, and Twilio status.
- [ ] **TECH-04**: Knowledge base ingestion endpoints enforce rate limits.
- [ ] **TECH-05**: Twilio webhook failures trigger retry logic with exponential backoff.
- [ ] **TECH-06**: Creem.io webhook event handlers enforce strict idempotency logic (no double processing).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stripe Integration | Project strictly mandates Creem.io as the MoR. |
| Custom VoIP/Web Dialer | Focus remains strictly on Twilio infrastructure; no browser-based calling requested. |
| Self-hosted LLMs | Infrastructure overhead is too high. Must stick to managed APIs (OpenAI/Anthropic). |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BIZ-01 | Phase 1 | Pending |
| BIZ-02 | Phase 1 | Pending |
| BIZ-03 | Phase 1 | Pending |
| BIZ-04 | Phase 1 | Pending |
| BIZ-05 | Phase 1 | Pending |
| BIZ-06 | Phase 2 | Pending |
| BIZ-07 | Phase 2 | Pending |
| CX-01 | Phase 3 | Pending |
| CX-02 | Phase 3 | Pending |
| CX-03 | Phase 3 | Pending |
| CX-04 | Phase 3 | Pending |
| CX-05 | Phase 3 | Pending |
| CX-06 | Phase 3 | Pending |
| AI-07 | Phase 4 | Pending |
| AI-08 | Phase 4 | Pending |
| AI-09 | Phase 4 | Pending |
| AI-10 | Phase 4 | Pending |
| AI-11 | Phase 4 | Pending |
| AI-12 | Phase 4 | Pending |
| AI-13 | Phase 4 | Pending |
| AI-01 | Phase 5 | Pending |
| AI-02 | Phase 5 | Pending |
| AI-03 | Phase 5 | Pending |
| AI-04 | Phase 5 | Pending |
| AI-05 | Phase 5 | Pending |
| AI-06 | Phase 5 | Pending |
| AI-14 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| DASH-06 | Phase 6 | Pending |
| DASH-07 | Phase 6 | Pending |
| TECH-01 | Phase 7 | Pending |
| TECH-02 | Phase 7 | Pending |
| TECH-03 | Phase 7 | Pending |
| TECH-04 | Phase 7 | Pending |
| TECH-05 | Phase 7 | Pending |
| TECH-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after initial definition*
