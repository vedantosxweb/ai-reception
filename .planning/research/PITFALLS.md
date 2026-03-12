# Project Research: Pitfalls Dimension

## Common Mistakes & Mitigation Strategies

### 1. Webhook Timeout & "Dead Air" Drops
- **Warning Sign:** Twilio call logs show `11200` HTTP retrieval failure errors.
- **The Mistake:** Processing heavy RAG or LLM tasks synchronously inside the main webhook loop on standard serverless tiers (which time out in 10s-30s).
- **Prevention Strategy:** Use streaming TwiML to respond immediately with a fallback (<Say> "One moment...") while handing off the heavy text-to-speech task. Ensure background parsing uses BullMQ for resilience.

### 2. Multi-Tenant Data Leakage
- **Warning Sign:** An AI receptionist references a product or knowledge base article belonging to a different tenant.
- **The Mistake:** Forgetting to append `tenantId` strict filters to the RAG vector search or genericizing the system prompt incorrectly during concurrent calls.
- **Prevention Strategy:** Enforce `tenantId` at the row level in `pgvector` queries and write integration tests specifically for cross-tenant isolation.

### 3. Infinite Billing Event Loops
- **Warning Sign:** A user's account is credited/debited multiple times for a single interaction.
- **The Mistake:** Webhook handlers for Creem.io aren't idempotent. If a webhook fails mid-way and Creem retries, it triggers the same database increment twice.
- **Prevention Strategy:** Store a `processed_events` table or Redis set. Check `if (event_id in processed_events)` before executing billing logic.

### 4. Spam Call Overage Drain
- **Warning Sign:** High LLM API bills without any legitimate booked leads or valid transcripts.
- **The Mistake:** Answering every ping from telemarketers or robocalls with expensive GPT-4 API calls.
- **Prevention Strategy:** Implement Twilio's spam lookup and the tenant blocklist *before* the first OpenAI token is generated. Eject the call with a quick 403 or hang-up TwiML if flagged.
