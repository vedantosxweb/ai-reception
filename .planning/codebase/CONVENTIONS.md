# Coding Conventions

## Principles
- **Strict Typing:** TypeScript is used extensively. Ensure explicit types for API inputs, outputs, and component props via Zod schemas and TypeScript interfaces.
- **Client vs. Server Components (RSC):** Next.js 15+ convention. By default, components are server-rendered. Use `"use client"` directive only at the top of files that require interactivity (hooks, state, browser APIs).
- **Error Handling:** Centralized through `Sentry` for monitoring. Validation errors are handled via `Zod` schemas. Wrap external API calls in `try/catch` and log appropriately using standard logger conventions (`src/lib/logger.ts`, e.g., Pino).

## Formatting and Linting
- **Styling:** Tailwind CSS integrated using utility classes (`cn` or `clsx` + `tailwind-merge` utility structure mapped out in `src/lib/utils.ts` for handling dynamic class composition).
- **ESLint/Prettier:** Project enforces `eslint-config-next` and standard Next.js linting rules (`npm run lint`).
- **Commits:** Conventional commits if applicable, following standard prefixing (`feat:`, `fix:`, `docs:`).

## Component Structure
Prefer small, self-contained, functional components over large monolithic ones. Keep business logic out of UI components inside `src/components/`, moving logic into custom hooks (`src/hooks/`) or service utilities (`src/lib/`).
