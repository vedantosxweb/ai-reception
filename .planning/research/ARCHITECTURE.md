# Project Research: Architecture Dimension

## Component Boundaries
1. **Webhook Interface Layer (Next.js API Routes):** Handles raw incoming POST requests from Twilio and Creem.io. Extremely lightweight to prevent timeout drops.
2. **Service Orchestration Layer (`src/lib/services`):** Maps incoming webhooks to specific tenant behaviors. Handles rate limiting (via Upstash Redis) and spam detection (via Twilio Lookup) before engaging heavy AI models.
3. **AI Pipeline Layer (`src/lib/ai`):** Coordinates RAG retrieval (Prisma `pgvector`), prompt injection (Caller History data), and LLM execution (OpenAI Realtime API or standard GPT-4o-mini).
4. **Asynchronous Execution Layer (BullMQ + Redis):** Manages outbound scheduling, post-call SMS summaries, and FAQ generation jobs that exceed Vercel's 30s serverless limit.

## Data Flow
- **Inbound Call:** Twilio -> Webhook -> Tenant Config Check -> Spam Block Check -> AI Greeting -> Audio Stream -> LLM Processing -> TTS Response -> Twilio TwiML.
- **Billing Event:** Creem.io -> Webhook -> Event Idempotency Check (Redis) -> User Subscription Update (PostgreSQL).
- **Background Tasks:** Next.js Route schedules job -> Redis Queue -> Background Worker picks up -> Execution (e.g., FAQ builder, Outbound call).

## Suggested Build Order (Dependencies)
1. **Foundation:** Implement Twilio auto-provisioning and Creem.io idempotent billing handlers first to secure the multi-tenant base.
2. **Core Experience:** Build the customizable greetings, caller memory, and lead capture hooks into the existing AI pipeline.
3. **Complex Logic:** Add Sentiment Escalation and Multilingual Auto-Detect as mid-pipeline middlewares.
4. **Asynchronous Features:** Construct the Outbound Engine, Call Scheduling, and FAQ auto-builder last, as they rely heavily on BullMQ stability and the RAG base.
