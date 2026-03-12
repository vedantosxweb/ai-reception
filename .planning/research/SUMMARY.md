# Domain Research Summary: AI Receptionist SaaS

## Stack Choices
- **Frontend/Backend:** Next.js (App Router) v15.2+ and TypeScript.
- **Database Layer:** PostgreSQL with `pgvector` accessed via Prisma v6.4+.
- **Voice AI Pipeline:** Deepgram (STT with sentiment/language detect) + OpenAI Realtime API (LLM) + ElevenLabs (TTS).
- **Telephony & MoR:** Twilio SDK for routing/provisioning and Creem.io for Merchant of Record billing.
- **Background Queue:** BullMQ with Upstash Redis for asynchronous tasks (e.g., outbound calls).

## Key Features & Expectations
- **Table Stakes:** Real-time telephony webhooks, strict multi-tenant RAG isolation, and usage-based billing.
- **Differentiators:** Multilingual auto-detection, sentiment-based live human escalation, semantic FAQ auto-builders, and dynamic outbound call scheduling.

## Architectural Boundaries
- Keep webhook handlers (Twilio/Creem.io) ultra-lightweight. Perform immediate security/idempotency checks, then hand off heavy processing or streaming setups.
- Isolate LLM context by always enforcing `tenantId` strict querying against the `pgvector` knowledge base and the caller history DB.

## Critical Pitfalls to Avoid
- **Webhook Timeouts:** Do not perform slow processing inline. Rely on streaming audio responses and rapid TwiML offloads.
- **Infinite Billing Loops:** Enforce redis-backed idempotency keys on every Creem.io webhook event to prevent double-charging.
- **Spam API Burn:** Integrate Twilio Lookup v2 blocklists at the entry point *before* hitting expensive Deepgram/OpenAI API layers.
