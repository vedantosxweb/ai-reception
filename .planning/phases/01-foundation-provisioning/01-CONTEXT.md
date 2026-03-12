# Phase 1: Foundation & Provisioning - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md)

<domain>
## Phase Boundary

Establish secure, idempotent billing foundations using Creem.io and build the self-serve Twilio number provisioning UI and logic for tenants.

</domain>

<decisions>
## Implementation Decisions

### Billing & Idempotency
- [TECH-06] **Creem.io Idempotent Webhooks:** All incoming Creem.io webhooks must be verified for idempotency using Redis or a `processed_events` PG table to prevent double-billing on retries.

### Twilio Provisioning
- [BIZ-01] **Number Search/Purchase UI:** Add a dashboard panel calling Twilio's AvailablePhoneNumbers API to allow tenants to buy directly.
- [BIZ-02] **Auto-Configuration:** Immediately upon purchase, the Twilio REST API must be used to configure the number's Voice, SMS, and WhatsApp webhooks pointing to our production `/api/v1/` routes.
- [BIZ-04] **Status Tracking:** UI must show if a number is `pending`, `active`, or `released`.

### Tenant Data Binding
- [BIZ-03] **Phone Number DB Binding:** Purchased numbers must be saved to the database explicitly linked to the purchasing `tenantId`.
- [BIZ-05] **BYON Flow:** Create a clear UI flow bridging existing manual "Bring Your Own Number" logic for tenants who don't want to buy via Twilio.

### Claude's Discretion
- Specific UI layout for the number search tool (assume shadcn tables/cards).
- Exact Redis key structure for idempotency tracking (e.g., `creem:event:{id}`).

</decisions>

<specifics>
## Specific Ideas
- The Twilio purchase flow should enforce the tenant's country or region if available in their profile to default the area code search.

</specifics>

<deferred>
## Deferred Ideas
- Per-number custom greetings (Wait for Phase 3).
- Onboarding Wizard routing (Wait for Phase 2).

</deferred>

---

*Phase: 01-foundation-provisioning*
*Context gathered: 2026-03-12 via PRD Express Path*
