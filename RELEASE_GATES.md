# Release Gates

The release is considered **green** only when all checks below pass:

1. `npm run ci:check`
2. `npm run launch:check`
3. `npm run launch:uat` (or `npm run launch:uat:skip-llm` if LLM keys are intentionally unavailable)
4. `npm run dev` starts successfully and `/api/v1/health` returns healthy
5. Twilio webhook routes boot without runtime errors:
   - `GET /api/webhooks/twilio/voice`
   - `GET /api/webhooks/twilio/sms`
   - `GET /api/webhooks/twilio/status`
   - `GET /api/webhooks/twilio/whatsapp`

## Quick smoke script

```bash
npm run ci:check
npm run launch:check
npm run launch:uat
npm run dev
curl -s http://localhost:3000/api/v1/health
curl -s http://localhost:3000/api/webhooks/twilio/voice
curl -s http://localhost:3000/api/webhooks/twilio/sms
curl -s http://localhost:3000/api/webhooks/twilio/status
curl -s http://localhost:3000/api/webhooks/twilio/whatsapp
```
