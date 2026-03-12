# Phase 2: Onboarding & AI Setup - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md)

<domain>
## Phase Boundary

Build a multi-step onboarding wizard for new tenants to configure their first AI receptionist, select a voice, and upload initial knowledge base documents.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Wizard
- [BIZ-08] **Routing:** New tenants (no AI receptionists in DB) should be redirected from the dashboard to `/onboarding`.
- **Steps:** 
  1. Business Info (Name, Industry)
  2. AI Personality (Name, Greeting, LLM Prompt)
  3. Voice Setup (Provider, Voice ID, Speed)
  4. Knowledge Base (Initial upload)

### AI Receptionist Config
- [INT-01] **Prompt Builder:** Provide a text area for the system prompt.
- [INT-02] **Voice Selection:** Support OpenAI (default) and ElevenLabs.
- [INT-04] **Voice Speed:** Range 0.5x to 2.0x.

### Knowledge Base (RAG)
- [RAG-01] **Manual Upload:** Support text snippets and PDF uploads. For this phase, use simple text extraction for PDFs.
- **Storage:** Save to `KnowledgeSource` table with status `READY` (syncing logic comes in Phase 4).

### SMS Follow-up
- [CXP-04] **Welcome SMS:** Toggle to enable/disable automated SMS follow-up after the first call.

</decisions>

<specifics>
## Specific Ideas
- Use a `Stepper` component for the onboarding flow.
- Preview voice snippets using the Twilio or provider SDKs if possible, or simple static samples.

</specifics>

<deferred>
## Deferred Ideas
- Website crawling (Wait for Phase 4).
- Advanced RAG chunking optimizations (Wait for Phase 4).
- Outbound Call Engine (Wait for Phase 5).

</deferred>

---

*Phase: 02-onboarding-setup*
*Context gathered: 2026-03-12 via PRD Express Path*
