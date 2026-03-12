# Architecture

## Pattern & Layers
- **App Router (Next.js 15+):** Utilizes React Server Components (RSC) by default for better performance and SEO.
- **API Routes:** Hosted in `src/app/api/...` handling server-side logic, webhooks, and third-party integrations (Twilio, Clerk, OpenAI).
- **Service Layer logic:** Extracted to `src/lib/` (e.g., `src/lib/services/`, `src/lib/telephony/`, `src/lib/ai/`) instead of cluttering Route Handlers.
- **Data Access Layer:** Prisma ORM handles db interactions.

## Data Flow
- Client requests hit `src/app/api/` routes (with standard Next.js request/response).
- API routes validate request payloads using Zod schemas.
- Controller/Route passes validated data to service modules in `src/lib/`.
- Services orchestrate operations: DB reads/writes via Prisma (`src/lib/db.ts`), background tasks via BullMQ (`src/lib/queue/`), and external API calls.

## Entry Points
- **Web UI:** `src/app/page.tsx` (landing), `src/app/dashboard/` (authenticated layout).
- **API/Webhooks:** `src/app/api/` (Twilio webhooks, Clerk webhooks, Stripe billing events).

## Background Processing
- Uses Redis and BullMQ (`src/lib/queue/` and `src/lib/redis.ts`) to offload heavy tasks like email sending, webhook processing, or LLM-based asynchronous jobs.
