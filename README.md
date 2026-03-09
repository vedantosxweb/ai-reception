# AI Receptionist SaaS Platform

Production-ready, multi-tenant AI Receptionist platform with voice AI, phone handling, SMS, knowledge base, analytics, and subscription billing.

## Architecture

```
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── auth/                 # NextAuth endpoints
│   │   │   ├── v1/                   # Versioned REST API
│   │   │   │   ├── analytics/        # Call & usage analytics
│   │   │   │   ├── audit-logs/       # Audit trail viewer
│   │   │   │   ├── auth/             # Registration
│   │   │   │   ├── billing/          # Stripe subscriptions & portal
│   │   │   │   ├── calls/            # Call log management
│   │   │   │   ├── directory/        # Company directory CRUD
│   │   │   │   ├── health/           # Health check endpoint
│   │   │   │   ├── knowledge/        # Knowledge base management
│   │   │   │   ├── phone-numbers/    # Phone number provisioning
│   │   │   │   ├── receptionists/    # AI Receptionist CRUD & setup wizard
│   │   │   │   ├── sms/             # SMS messaging
│   │   │   │   ├── tenants/          # Tenant settings
│   │   │   │   ├── transfers/        # Transfer rule management
│   │   │   │   └── users/            # Team member management
│   │   │   └── webhooks/
│   │   │       ├── stripe/           # Stripe webhook handler
│   │   │       └── twilio/           # Voice, SMS, Status webhooks
│   │   ├── dashboard/                # Dashboard page (SSR with auth)
│   │   ├── login/                    # Sign in page
│   │   ├── onboarding/              # Setup wizard UI
│   │   └── signup/                   # Registration page
│   ├── components/
│   │   ├── dashboard/                # Dashboard panels
│   │   │   ├── overview.tsx          # KPI cards, call volume chart, recent calls
│   │   │   ├── receptionists.tsx     # CRUD for AI agents
│   │   │   ├── call-logs.tsx         # Searchable call log table
│   │   │   ├── knowledge-panel.tsx   # Knowledge base management
│   │   │   ├── directory-panel.tsx   # Company directory
│   │   │   ├── analytics-panel.tsx   # Detailed analytics with charts
│   │   │   ├── billing-panel.tsx     # Plan management & usage
│   │   │   ├── settings-panel.tsx    # Company settings & business hours
│   │   │   └── shell.tsx             # Dashboard layout with sidebar
│   │   └── ui/                       # shadcn/ui components
│   ├── lib/
│   │   ├── ai/                       # LLM abstraction (OpenAI, Anthropic, Gemini)
│   │   ├── billing/                  # Stripe service (subscriptions, usage, webhooks)
│   │   ├── config/                   # Environment validation (Zod)
│   │   ├── knowledge/                # Web scraping, chunking, retrieval
│   │   ├── services/                 # Tenant service
│   │   ├── telephony/                # Twilio abstraction (TwiML, SMS, calls)
│   │   ├── api-auth.ts              # Session middleware, RBAC, rate limiting
│   │   ├── auth.ts                  # NextAuth config with multi-tenancy
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── logger.ts               # Pino structured logging
│   │   └── utils.ts                 # Utility functions
│   ├── middleware.ts                 # NextAuth route protection
│   └── types/                        # TypeScript type definitions
├── prisma/
│   └── schema.prisma                # 25+ models with full multi-tenancy
├── Dockerfile                        # Multi-stage production build
├── docker-compose.yml               # App + Worker + Redis orchestration
└── .env.example                     # All environment variables documented
```

## Features

### Multi-Tenancy
- Database-level tenant isolation on every table
- Row-level security via tenantId on all queries
- Tenant settings: company info, business hours, directory, timezone
- Plan-based feature limits (receptionists, phone numbers, knowledge sources)

### Subscription Billing (Creem.io)
- 4 tiers: Starter ($49), Growth ($149), Pro ($399), Enterprise ($999)
- Usage-based per-minute overage billing
- Creem webhook handling (checkout + subscription lifecycle)
- Customer portal integration for self-service billing (Creem customer portal)
- 14-day free trial on signup

### AI Voice Pipeline
- **Inbound call** → Phone number lookup → Tenant/Receptionist resolution
- **STT**: Twilio enhanced speech recognition (Deepgram/Google ready)
- **LLM**: OpenAI GPT-4o / Anthropic Claude / Google Gemini with fallback chain
- **TTS**: Twilio Polly voices (ElevenLabs/PlayHT/OpenAI TTS ready)
- Real-time conversation with context memory per call session
- Interruption handling, silence detection, emergency keyword detection
- Intent classification, sentiment analysis, lead scoring
- Transfer logic with directory matching and configurable rules
- Guardrails: hallucination prevention, knowledge-base-only responses

### SMS Integration
- Inbound SMS auto-response with AI
- SMS follow-up after voice calls
- Booking links, business hours via text
- Per-tenant SMS tracking and usage

### Knowledge Base
- Website scraping (services, FAQs, hours, contact info auto-extracted)
- Manual FAQ entry
- Text content sources
- Chunking with overlap for retrieval
- Per-tenant, per-receptionist isolation
- Ready for Pinecone/vector DB upgrade

### Setup Wizard
- 6-step onboarding: Voice → Company → Website → Greeting → Directory → Deploy
- Auto-scrapes website and populates knowledge base
- Creates AI Receptionist with full configuration
- Populates directory and transfer rules

### Enterprise Dashboard
- **Overview**: KPI cards, call volume charts, recent calls, usage meters
- **AI Receptionists**: Create, configure, activate/pause, delete agents
- **Call Logs**: Searchable table with caller info, duration, intent, sentiment
- **Knowledge Base**: Add website/FAQ/text sources, view processing status
- **Directory**: Company directory with departments and extensions
- **Analytics**: Call volume, sentiment distribution, top intents, transfer rates
- **Billing**: Current plan, usage summary, upgrade/downgrade, Stripe portal
- **Settings**: Company info, business hours, timezone

### Security
- JWT authentication via NextAuth with tenant context
- RBAC: Owner, Admin, Member, Viewer roles
- API session middleware with role enforcement
- In-memory rate limiting (Redis-backed in production)
- Twilio webhook signature validation
- Stripe webhook signature verification
- Audit logging on all state-changing operations
- Input validation with Zod
- HTTPS-only in production
- Password hashing with bcryptjs (12 rounds)

### Database Schema (25+ models)
- `Tenant` with Stripe integration and plan limits
- `User` with multi-tenant scoping and RBAC
- `Subscription`, `Invoice` synced with Stripe
- `AIReceptionist` with full voice/LLM/STT configuration
- `PhoneNumber` with provider abstraction
- `KnowledgeSource` + `Embedding` for knowledge base
- `Call`, `CallEvent`, `Transcript`, `Transfer` for call pipeline
- `SMSMessage` for text messaging
- `UsageRecord` for billing metering
- `AuditLog` for compliance
- `Contact`, `Appointment`, `BusinessHour`, `DirectoryEntry`, `TransferRule`

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL (or Neon/Supabase)
- Redis (optional for development)

### Setup

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Push database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### Required API Keys

| Service | Required | Purpose |
|---------|----------|---------|
| PostgreSQL | Yes | Database |
| NextAuth Secret | Yes | JWT signing |
| OpenAI / Anthropic / Gemini | Yes (1+) | AI responses |
| Twilio | Yes | Voice calls & SMS |
| Creem.io | For billing | Subscriptions + customer portal |
| Deepgram | Optional | Enhanced STT |
| ElevenLabs | Optional | Premium TTS |
| Pinecone | Optional | Vector search |
| Redis | Production | Queue & cache |

### Runtime Flags

| Variable | Default | Notes |
|----------|---------|-------|
| `ENABLE_SMS` | `true` | Set to `false` to disable SMS webhook handling |
| `TWILIO_WEBHOOK_STRICT_VALIDATION` | `true` in production, `false` in non-production | Override to force strict/non-strict signature validation |
| `ENCRYPTION_KEY` | unset | Required for encrypted-at-rest integration credentials (`openssl rand -hex 32`) |
| `AVERAGE_APPOINTMENT_VALUE` | `200` | Used for estimated revenue KPI in analytics |

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth` | Public | Canonical registration endpoint |
| POST | `/api/auth/register` | Public | Backward-compatible registration path |
| POST | `/api/auth/[...nextauth]` | Public | NextAuth sign in |
| GET | `/api/v1/health` | Public | Health check |
| GET | `/api/v1/tenants` | Session | Get tenant info |
| PATCH | `/api/v1/tenants` | Admin+ | Update tenant settings |
| GET | `/api/v1/receptionists` | Session | List receptionists |
| POST | `/api/v1/receptionists` | Admin+ | Create receptionist |
| PATCH | `/api/v1/receptionists` | Admin+ | Update receptionist |
| DELETE | `/api/v1/receptionists` | Admin+ | Delete receptionist |
| POST | `/api/v1/receptionists/wizard` | Admin+ | Setup wizard |
| GET | `/api/v1/receptionists/wizard?url=` | Session | Scrape website |
| GET | `/api/v1/calls` | Session | List call logs |
| GET | `/api/v1/knowledge` | Session | List knowledge sources |
| POST | `/api/v1/knowledge` | Admin+ | Add knowledge source |
| DELETE | `/api/v1/knowledge` | Admin+ | Delete knowledge source |
| GET | `/api/v1/directory` | Session | List directory |
| POST | `/api/v1/directory` | Admin+ | Add directory entry |
| PATCH | `/api/v1/directory` | Admin+ | Update directory entry |
| DELETE | `/api/v1/directory` | Admin+ | Delete entry |
| GET | `/api/v1/transfers` | Session | List transfer rules |
| POST | `/api/v1/transfers` | Admin+ | Create transfer rule |
| PATCH | `/api/v1/transfers` | Admin+ | Update transfer rule |
| DELETE | `/api/v1/transfers` | Admin+ | Delete transfer rule |
| GET | `/api/v1/users` | Session | List team members |
| POST | `/api/v1/users` | Admin+ | Invite/create user |
| PATCH | `/api/v1/users` | Admin+ | Update user |
| DELETE | `/api/v1/users` | Admin+ | Remove user |
| GET | `/api/v1/phone-numbers` | Session | List phone numbers |
| POST | `/api/v1/phone-numbers` | Admin+ | Provision phone number |
| PATCH | `/api/v1/phone-numbers` | Admin+ | Update assignment |
| DELETE | `/api/v1/phone-numbers` | Admin+ | Release phone number |
| GET | `/api/v1/sms` | Session | SMS message history |
| POST | `/api/v1/sms` | Admin+ | Send SMS |
| GET | `/api/v1/audit-logs` | Admin+ | View audit trail |
| POST | `/api/v1/audit-logs` | Admin+ | Manual audit entry |
| GET | `/api/v1/analytics` | Session | Analytics data |
| GET | `/api/v1/billing` | Session | Billing & usage |
| POST | `/api/v1/billing` | Admin+ | Subscribe/change/cancel |
| POST | `/api/v1/billing/portal` | Admin+ | Creem portal session |
| POST | `/api/webhooks/twilio/voice` | Twilio | Voice call handler |
| POST | `/api/webhooks/twilio/sms` | Twilio | SMS handler |
| POST | `/api/webhooks/twilio/status` | Twilio | Call status updates |
| POST | `/api/webhooks/creem` | Creem | Checkout/subscription events |

### Docker Deployment

```bash
# Build and run
docker compose up -d

# View logs
docker compose logs -f app

# Scale workers
docker compose up -d --scale worker=3
```

### Production Deployment

1. Set all environment variables in your hosting provider
2. Ensure `DATABASE_URL` points to a production PostgreSQL instance
3. Run `npx prisma db push` against production database
4. Configure Twilio webhook URLs to point to your domain:
   - Voice: `https://yourdomain.com/api/webhooks/twilio/voice`
   - SMS: `https://yourdomain.com/api/webhooks/twilio/sms`
   - Status: `https://yourdomain.com/api/webhooks/twilio/status`
5. Configure Creem webhook URL:
   - `https://yourdomain.com/api/webhooks/creem`
   - Events: `checkout.completed`, `subscription.active`, `subscription.paid`, `subscription.scheduled_cancel`, `subscription.canceled`, `subscription.past_due`, `subscription.expired`
6. Set `ENCRYPTION_KEY` and run `npm run integrations:backfill-encryption` once if you already have integration credentials stored in plaintext
7. Deploy via Docker, Vercel, Railway, or any Node.js host

### Environment Variables

See `.env.example` for the complete list with documentation.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js v4 (JWT, Credentials)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui, Recharts, Framer Motion
- **AI**: OpenAI, Anthropic, Google Gemini (pluggable)
- **Telephony**: Twilio (Telnyx ready)
- **Billing**: Creem (subscriptions + usage metering)
- **Queue**: BullMQ + Redis (ready)
- **Deployment**: Docker, standalone Next.js output
