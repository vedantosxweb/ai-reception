---
phase: 3
title: Core Call Experience
goal: Enable personalized greetings, lead capture, and smarter call handling (VIP/Hold).
dependencies: [2]
---

# Phase 3: Core Call Experience Context

This phase shifts focus from infrastructure to the actual calling experience. We are introducing logic that makes the AI feel more integrated with the business (custom greetings), more respectful of business owners (VIP bypass), and more useful (lead capture).

## Key Components

1. **Personalization:**
   - Numbers can have their own "opening line" before the AI takes over.
   - VIP lists allow certain users to bypass DND hours.

2. **Wait Experience:**
   - Hold music or wait tones to bridge latency gaps.

3. **Value Capture:**
   - Extracting structured data (leads) from unstructured conversations.
   - Syncing to CRM (HubSpot).

## Execution Strategy
- Start with Schema changes.
- Implement mid-call logic in `voice.service.ts` and `ai.service.ts`.
- Finish with analytical dashboard for Leads.
