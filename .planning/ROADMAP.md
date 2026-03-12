# Roadmap: AI Receptionist SaaS

**Project:** AI Receptionist SaaS Milestone
**Current Phase:** Phase 1
**Total Phases:** 7

## Phase 1: Foundation & Provisioning
**Goal:** Establish secure, idempotent billing foundations and self-serve Twilio provisioning.
- **Dependencies:** None
- **Key Deliverables:** 
  - Idempotent Creem.io Webhooks (TECH-06)
  - Twilio number purchase/search UI (BIZ-01, BIZ-04)
  - Auto-webhook Twilio configuration (BIZ-02)
  - DB tenant bindings for numbers (BIZ-03, BIZ-05)

## Phase 2: Tenant Onboarding Flow
**Goal:** Build the post-signup wizard to smoothly activate new tenants.
- **Dependencies:** Phase 1 (requires provisioning flows to be functional)
- **Key Deliverables:**
  - 4-step onboarding UI (BIZ-06)
  - DB persistence of onboarding completion state (BIZ-07)

## Phase 3: Core Call Experience
**Goal:** Make the foundational AI call experience richer for inbound callers.
- **Dependencies:** Phase 1 (requires active numbers)
- **Key Deliverables:**
  - Database schema & UI for per-number custom greetings (CX-01)
  - VIP Number caller bypassing and Do-Not-Disturb logic (CX-02)
  - Hold Music & Wait tone integration during AI latency (CX-03)
  - New Caller Lead Capture prompting & DB insertion (CX-04, CX-05)
  - HubSpot Sync integration for leads (CX-06)

## Phase 4: Mid-Call Intelligence
**Goal:** Inject real-time analytical power directly into the active call loops.
- **Dependencies:** Component boundaries mapped in `ARCHITECTURE.md` (Spam before AI)
- **Key Deliverables:**
  - Spam Lookup integration at incoming webhook boundary (AI-07, AI-08)
  - Multilingual Auto-Detect using first 2s audio slice (AI-13)
  - Caller History context injection query on call start (AI-12)
  - Real-time Sentiment detection & Escalation routing logic (AI-09, AI-10, AI-11)

## Phase 5: Outbound & Asynchronous Background Tasks
**Goal:** Build the outbound scheduling engine and delayed execution services.
- **Dependencies:** Phase 4 (History), BullMQ infrastructure
- **Key Deliverables:**
  - Queue worker setup for Outbound calls (AI-01)
  - Automatic missed-call follow-ups (AI-02)
  - Post-call SMS summary sender (AI-03)
  - Schedule Call intent detection & Google Calendar slot offering (AI-04, AI-05, AI-06)
  - Weekly FAQ Auto-Builder Job (AI-14)

## Phase 6: Dashboards & Analytics Visibility
**Goal:** Surface all the new intelligent feature data into the tenant dashboards.
- **Dependencies:** Phases 3, 4, and 5 (needs leads, history, and outbound logs to display)
- **Key Deliverables:**
  - Real-time missed call alerts (DASH-01, DASH-02)
  - Call Logs CSV Export Builder (DASH-03)
  - Full-text search for transcripts via Prisma (DASH-04, DASH-05)
  - Receptionist Performance Scorecards (DASH-06)
  - Daily/Weekly Resend Email Digest Chron (DASH-07)

## Phase 7: Stability, Quality & Polish
**Goal:** Lock down the infrastructure with comprehensive tests and optimizations.
- **Dependencies:** All previous functional phases
- **Key Deliverables:**
  - Full E2E tests for Webhook -> AI -> Log (TECH-01)
  - DB Indexing across all active tables (TECH-02)
  - Multi-service Health Endpoint (TECH-03)
  - Rate limiting logic on heavy endpoints (TECH-04)
  - Twilio exponential backoff retries (TECH-05)
