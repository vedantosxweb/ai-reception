# Directory Structure & Conventions

## Overview

```text
src/
├── app/               # Next.js App Router pages and API routes
│   ├── api/           # Backend API route handlers (webhooks, internal API)
│   ├── dashboard/     # Authenticated user dashboard views
│   ├── onboarding/    # New user setup flow
│   └── page.tsx       # Public landing page
├── components/        # Reusable React components
│   ├── dashboard/     # Specific to dashboard views
│   ├── landing/       # Specific to landing page 
│   └── ui/            # Generic/Atomic UI components (shadcn/ui, Radix)
├── hooks/             # Custom React hooks
├── lib/               # Core business logic and integrations
│   ├── ai/            # LLM provider integrations (OpenAI, Anthropic)
│   ├── api-auth.ts    # Authentication helpers for API routes
│   ├── billing/       # Billing logic with Creem/Stripe
│   ├── db.ts          # Prisma client instantiation
│   ├── queue/         # BullMQ queue definitions
│   ├── redis.ts       # Redis client instantiation
│   └── telephony/     # Voice/SMS integration logic
└── types/             # Shared TypeScript interfaces and types
```

## Key Locations
- **Database Schema:** `prisma/schema.prisma`
- **Environment Example:** `.env.example`
- **Configuration:** `next.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`

## Naming Conventions
- React components use `PascalCase.tsx`.
- Hooks use `useCamelCase.ts`.
- Utility loops and services use `kebab-case.ts`.
- API routes live in `route.ts`.
- Pages live in `page.tsx`.
