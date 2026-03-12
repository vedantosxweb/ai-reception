# Project Research: Features Dimension

## Table Stakes (Must-Haves)
- **Real-Time Voice & SMS Processing:** Low latency audio streaming and instant messaging via Twilio webhooks.
- **RAG Knowledge Base:** Ability to ingest URLs or PDFs so the AI can answer business-specific questions accurately.
- **Multi-Tenant Architecture:** Strict isolation of data (call logs, knowledge base, settings) based on `tenantId`.
- **Billing & Subscriptions:** Tiered plans based on minutes used, managed via Creem.io MoR.
- **Basic Call Analytics:** Dashboard showing total calls, missed calls, and average duration.

## Differentiators (Competitive Advantage)
- **Outbound Scheduling & Follow-ups:** Automated post-call SMS summaries and 10-minute follow-up calls for missed connections.
- **Real-Time Calendar Integration:** Dynamic slot offering and immediate booking via Google Calendar APIs.
- **Sentiment-Based Escalation:** Instant detection of frustration followed by human transfer or WhatsApp alerts to the store owner.
- **Caller Memory & Personalization:** Recognizing returning phone numbers, referencing past context, and greeting callers by name.
- **Multilingual Auto-Detect:** Using Deepgram/Whisper to dynamically change spoken language in the first 2 seconds of a call based on the user's accent/language.

## Anti-Features (What NOT to build)
- **Stripe Integration:** The milestone explicitly dictates Creem.io for MoR compliance.
- **Custom VoIP Clients:** Do not build a SIP app or web dialer. All routing and communication should remain offloaded to Twilio.
- **Local/Self-Hosted LLMs:** Requires massive infrastructure overhead. Stick to managed APIs (OpenAI/Anthropic/Gemini) for the core brain.

## Complexity & Dependencies
- **High Complexity:** Multilingual Auto-Detect (requires rapid audio chunking and real-time prompt injection) and Outbound Engine (requires robust BullMQ background queuing).
- **Dependency:** Outbound scheduling relies strictly on Google Calendar API integration being robust and handling rate limits gracefully.
