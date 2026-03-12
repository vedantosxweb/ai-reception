# Concerns & Tech Debt

## Active Issues & Fragile Areas
- **Webhook Routing (`whatsapp:`):** Recent focus on fixing WhatsApp webhook prefixes. Handlers dealing with raw string manipulations or regex for channels (Voice vs. SMS vs. WhatsApp) can be fragile and should be standardized and heavily tested.
- **Authentication Middleware:** There have been recent struggles with `Clerk` middleware throwing errors or blocking development. Make sure `middleware.ts` handles public vs. private routes correctly to prevent infinite redirects or unauthenticated leaking.
- **LLM Rate Limits & Latency:** Real-time telephony deeply relies on OpenAI/Deepgram/ElevenLabs API latency. Lack of streaming or fallback mechanisms can result in "dead air" on calls if external services are slow.

## Technical Debt Tracker
- **Missing Tests:** The project setup has Vitest configured, but there are minimal actual tests (e.g., only an `example.test.tsx` found). Expanding to critical paths (like Webhooks and Job processing) is a high priority.
- **Multiple NLP Providers:** Integrating OpenAI, Anthropic, AND Gemini means maintaining multiple SDK integrations and genericizing the interfaces or standardizing function-calling logic across them.
- **Secret Management:** Keeping track of many API keys requires strict validation at startup (e.g., using `t3-env` or a robust Zod checking mechanism found in `src/lib/config` or `launch-readiness-check.js`).
