# Research: Project Stack Research — Stack Dimension for AI Receptionist SaaS

## Core Stack Recommendations (2025)

| Dimension | Recommendation | Version | Rationale | Confidence |
|-----------|----------------|---------|-----------|------------|
| **Frontend/Backend** | Next.js (App Router) | 15.2.x | Standard for full-stack AI apps; optimized for PPR (Partial Prerendering) and React 19. | High |
| **ORM** | Prisma | 6.4.x | First-class support for `pgvector`, which is critical for the FAQ auto-builder and RAG routing. | High |
| **Database** | PostgreSQL | 16+ | Robust, multi-tenant capable, and supports vector search via extensions. | High |
| **Auth** | Clerk | v5+ | Handles multi-tenancy and organization switching natively. | High |
| **Voice AI Pipeline (STT)** | Deepgram | v3.x | Lowest latency (<300ms) for telephony; built-in sentiment and language detection. | High |
| **Voice AI Pipeline (Brain)** | OpenAI GPT-4o-mini | v4+ | Optimal balance of cost, speed, and reasoning for receptionist tasks. | High |
| **Real-time Pipeline** | OpenAI Realtime API | Alpha/Beta | Essential for ultra-low latency turn-taking, reducing awkward pauses in conversations. | Medium |
| **Voice AI Pipeline (TTS)** | ElevenLabs | v1.x | Top-tier human-like voice quality; essential for high-end customer experience. | High |
| **Telephony** | Twilio SDK | v5.x | Gold standard for number provisioning, SIP trunking, and high-volume Voice/SMS. | High |
| **Billing** | Creem.io | Latest | Merchant of Record (MoR) approach requested to handle global compliance and taxes. | High |
| **Integrations (Calendar)** | Googleapis | v144.x | Required for seamless booking and availability checks. | High |
| **Infrastructure (Cache)** | Upstash Redis | Latest | Serverless Redis for rate-limiting and overage protection logic. | High |

## Detailed Rationales

### 1. Unified Real-time Voice Pipeline
The move from sequential STT -> LLM -> TTS to unified streaming (Deepgram + OpenAI Realtime API) is the biggest shift in 2025. This reduces the "time-to-first-byte" of the AI's response from ~2-3 seconds down to <800ms, which is human-level.

### 2. Semantic Memory with pgvector
By using `pgvector` directly in PostgreSQL (via Prisma), we avoid the cost and latency of a separate vector database (like Pinecone). This simplifies multi-tenant data isolation, as each tenant's knowledge base can be partitioned within the same DB tables using RLS (Row Level Security).

### 3. Twilio Lookup v2 for Spam
The Lookup v2 API provides a specialized Identity and Spam score. Integrating this directly into the inbound webhook prevents the AI from engaging with robo-callers, saving on both LLM costs and Twilio minutes.

## What NOT to Use (and Why)
- **Stripe**: Explicitly disqualified in favor of Creem.io for MoR benefits.
- **LangChain (Heavyweight versions)**: Prefer lightweight vector queries or specialized RAG libraries to keep serverless cold starts minimal in Next.js.
- **External Vector DBs**: Use `pgvector` to keep architecture lean and multi-tenancy manageable.

## Quality Gates Verified
- [x] Versions are current as of mid-2025.
- [x] Rationale focuses on latency and architectural simplicity.
- [x] Confidence levels reflect the stability of the 2025 AI ecosystem.
