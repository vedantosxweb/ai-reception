# AI Receptionist SaaS Platform

Production-ready, multi-tenant AI Receptionist platform featuring intelligent voice handling, Twilio phone number provisioning, WhatsApp/SMS conversational agents, knowledge base grounding, detailed analytics, and tiered subscription billing.

## Architecture

```text
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── v1/                   # Versioned REST API
│   │   │   │   ├── analytics/        # Call & usage analytics
│   │   │   │   ├── audit-logs/       # Audit trail viewer
│   │   │   │   ├── billing/          # Stripe subscriptions & portal
│   │   │   │   ├── calls/            # Call log management
│   │   │   │   ├── directory/        # Company directory CRUD
│   │   │   │   ├── health/           # Health check endpoint
│   │   │   │   ├── knowledge/        # Knowledge base management
│   │   │   │   ├── phone-numbers/    # Twilio number provisioning
│   │   │   │   ├── internal-numbers/ # External manual number binding (e.g. WhatsApp)
│   │   │   │   ├── receptionists/    # AI Receptionist CRUD & setup wizard
│   │   │   │   ├── sms/              # Outbound SMS messaging
│   │   │   │   ├── tenants/          # Tenant settings
│   │   │   │   ├── transfers/        # Transfer rule management
│   │   │   │   └── users/            # Team member management
│   │   │   └── webhooks/
│   │   │       ├── stripe/           # Stripe webhook handler
│   │   │       ├── creem/            # Creem.io legacy webhook handler
│   │   │       └── twilio/           # Voice, SMS, WhatsApp, and Status webhooks
│   │   ├── dashboard/                # Main authenticated SaaS dashboard
│   │   ├── (auth)/                   # Clerk authentication pages (Sign In/Up)
│   │   └── onboarding/               # Setup wizard UI flow
│   ├── components/
│   │   ├── dashboard/                # Highly interactive dashboard panels
│   │   │   ├── overview.tsx          # Real-time KPIs and volume charts
│   │   │   ├── receptionists.tsx     # Configuration of AI personalities
│   │   │   ├── phone-numbers-panel.tsx # Linking AI Receptionists to external numbers
│   │   │   └── shell.tsx             # Dashboard Layout Sidebar
│   │   └── ui/                       # shadcn/ui shared components
│   ├── lib/
│   │   ├── ai/                       # AI orchestration (OpenAI, Anthropic, Gemini)
│   │   ├── billing/                  # Subscription handling abstractions
│   │   ├── config/                   # Zod environment variable parsing
│   │   ├── knowledge/                # Chunking and Retrieval Augmented Generation
│   │   ├── telephony/                # Twilio (Calls, SMS, WhatsApp, Provisioning)
│   │   ├── api-auth.ts               # Local RBAC and Clerk session middleware
│   │   ├── db.ts                     # Prisma ORM Singleton
│   │   └── redis.ts                  # Redis-backed rate limiting
│   ├── middleware.ts                 # Clerk Next.js routing protection
│   └── types/                        # TypeScript global types
├── prisma/
│   └── schema.prisma                 # 25+ models with full multi-tenancy rules
├── .env.example                      # Documented environment variables configuration
└── docker-compose.yml                # Optional local containerization
```

---

## Powerful Feature Set

### Full Multi-Tenancy Architecture
- Isolated workspaces utilizing `tenantId` row-level security boundaries.
- Individual configurations for business hours, global platform timezones, default language models.
- Plan-enforced utilization tracking (Maximum phone numbers, allocated LLM tokens, provisioned receptionists).
- Completely seamless user auto-provisioning driven by Clerk hooks mapping users instantly into the local PostgreSQL tables.

### Voice & Conversational AI Pipeline
- **Smart Telephony Pipeline**: `Inbound Call -> Webhook -> Prisma Phone Lookup -> Assistant Resolution -> AI Inference`.
- Engine support for **Speech-to-Text (STT)** via Deepgram, or Twilio native capabilities.
- Intelligent **Language Models (LLM)** supported: OpenAI GPT-4o, Google Gemini, Anthropic Claude. Automatically falls back over chain configurations.
- Actionable behavior features like intentional silence handling, caller interruptions detection, and semantic transfer reasoning.
- Fully contextual conversation grounding: Upload PDFs, scan static websites, and provide contextual RAG responses back to callers.

### WhatsApp & SMS Conversational Messaging
- Send text messages and robust rich media via WhatsApp and SMS endpoints automatically handled by the exact same Receptionist brain.
- Bind Twilio numbers universally across the platform directly inside the dedicated `Phone Numbers` dashboard to funnel external inbound text conversations through your pre-configured agents.
- Capable of following up intelligently after voice calls with context summary SMS bursts.

### Unified SaaS Dashboard
- **Overview**: Real-time business metrics tracking volume, latency, AI token expenditure, sentiment variations, and more.
- **Receptionists Builder**: No-code interface for spinning up personalities, attaching operational guardrails, picking TTS voice options, and tuning hyper-parameters like `maxTokens` or `temperature`.
- **Phone Numbers Directory**: Allocate or unlink phone numbers programmatically via Twilio, or map existing external Twilio phone numbers to new receptionists dynamically via the interface. 
- **Knowledge Base**: Drop files and URLs for immediate data ingestion and vector processing.
- **Billing Portal**: View utilized minutes spanning Voice and STT. Generate external Stripe Checkout portals right from settings.
- **Corporate Directory**: Build semantic dial-by-name schemas across the business.

### Security & Scaling
- **Clerk Auth**: Best-in-class sign up, JWT management, and multi-factor capabilities.
- **Rate Limiting**: Native Redis caching buffers inbound Twilio webhook floods and prevents backend API DDoSing automatically.
- **Structured Validation**: Zod types ensure malformed requests generated universally by users or Twilio are rejected seamlessly before hitting PostgreSQL.
- **Audit Trails**: Complete transparency records generated on mutating models (creating numbers, killing receptionists, linking numbers, etc).

---

## Quick Start & Deployment Details

### Prerequisites
- Node.js 20+
- PostgreSQL (e.g., Neon or Supabase)
- Redis Server (Required for Rate Limiting / Idempotency Locks)

### Getting Configured Locally

```bash
# Install NPM dependencies
npm install

# Copy configuration
cp .env.example .env
```

**CRITICAL: Open `.env` and fill out these required platform dependencies:**
- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`
- **Database**: `DATABASE_URL` 
- **Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- **AI Engines**: At least one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.

### Pushing the Database
```bash
# Push schema and regenerate client
npx prisma db push
npx prisma generate
```

### Launch
```bash
npm run dev
```

---

## Production Configuration Notes

1. **Clerk Middleware Alignment:**
   Ensure the `middleware.ts` file located at the root `src/middleware.ts` is exactly matching your Next.js application root logic. Do not rename it or Clerk's hooks will bypass standard routing procedures.

2. **Webhooks:**
   Configure your Twilio Numbers explicitly referencing your externally deployed site:
   - Voice Call Webhooks: `https://yourdomain.com/api/webhooks/twilio/voice`
   - SMS / MMS Delivery: `https://yourdomain.com/api/webhooks/twilio/sms`
   - WhatsApp Sender: `https://yourdomain.com/api/webhooks/twilio/whatsapp`

3. **Twilio Fallbacks:**
   If provisioning a WhatsApp sandbox directly inside `.env` via `TWILIO_WHATSAPP_NUMBER="whatsapp:+123..."`, be absolutely sure that number is **Also bound to a live Receptionist** inside your Cloud Dashboard. Otherwise, Vercel will process the trace footprint but safely kill the response sequence resulting in blank inbound replies.

4. **Webhooks Strict Signatures:**
   For local ngrok routing, utilize `TWILIO_WEBHOOK_STRICT_VALIDATION="false"`. For production deploys, omit it unless specifically debugging trace headers.

---

## Tech Stack Overview

- **Core**: Next.js 16 (App Router) + React 19 + TypeScript.
- **Data & Persistence**: Prisma ORM over PostgreSQL. 
- **Auth**: Clerk Core.
- **State Management & UI**: Radix UI + shadcn/ui + Tailwind CSS v4.
- **Telecommunications Integration**: Twilio Programmable Voice & Twilio messaging SDK.
- **Testing**: Vitest for Unit implementations.
- **AI Layers**: OpenAI SDK, Google Generative AI SDK.
