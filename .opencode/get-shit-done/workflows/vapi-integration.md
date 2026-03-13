---
description: How to maintain and update the Vapi.ai integration
---

# Vapi.ai Integration Workflow

This workflow guides you through maintaining and updating the Vapi.ai real-time voice integration.

## Core Components
1. **Webhook Handler**: `src/app/api/webhooks/vapi/route.ts` - Processes all Vapi events (tool calls, status updates, transcript sync).
2. **Tool Mappings**: Managed in the webhook handler, connecting Vapi "tools" to our internal services.
3. **State Management**: Vapi IDs are stored in `AIReceptionist` and `PhoneNumber` models.

## Update Process

### 1. Adding a New Tool
// turbo
1. Define the tool's JSON schema in the Vapi Dashboard.
2. In `src/app/api/webhooks/vapi/route.ts`, add a new case to the `tool-call` handler.
3. Map the tool parameters to the corresponding service method in `AppointmentService` or `AvailabilityService`.
4. Ensure the response follows the Vapi tool-call response format.

### 2. Updating Call Logic
1. Modify the system prompt in the Vapi Dashboard or via the `AIReceptionist` system prompt field.
2. If changing the voice, update it in the Vapi Assistant settings (Vapi overrides our internal TTS settings).

### 3. Monitoring & Debugging
- Check `CallEvent` and `Transcript` tables for synced data from Vapi.
- Use the Vapi Dashboard logs for real-time audio/latency debugging.
- Verify webhook signatures in `src/app/api/webhooks/vapi/route.ts` if production security is enabled.

## Troubleshooting
- **Latency issues**: Verify if Vapi is using a "Bring Your Own Key" (BYOK) for LLM/TTS and ensure those providers are healthy.
- **Tool failures**: Check terminal logs for Prisma errors or service exceptions during webhook processing.
