# Testing

## Frameworks & Tools
- **Runner:** `vitest`
- **UI Testing:** `@testing-library/react` and `@testing-library/jest-dom` for component rendering tests.
- **Coverage:** Configured via `vitest run --coverage`.

## Directory Structure
Tests are placed alongside their respective implementations. E.g., `src/components/example.test.tsx` (found during structure mapping).
There does not appear to be a dedicated centralized `/tests` or `/e2e` directory yet. 

## Best Practices
- Keep tests co-located with the source code `.test.ts` or `.test.tsx`.
- Mock external integrations (like OpenAI or Twilio) using `vi.mock()` inside the test files.
- Run UI mode using `npm run test:ui`.
