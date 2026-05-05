# E2E And External Verification Decision

## Current Decision

The active decision is now documented in `plan-report/2605051850_E2E_Real_Integration_Upgrade_Report.md` and related decision files.

User direction on 2026-05-05: remove mock-based E2E from the release path and prefer real operation checks.

## Recommended Strategy

- Default E2E: `backend-required`
- External dependency smoke: `external-smoke`, only with explicit approval and cost guard
- Mock route interception: removed from E2E release path
- Actual Supabase/LLM/Storage/chat usage checks: decision-gated because they can create cost, rate-limit, data cleanup, and quota side effects

## Decision Files

- `plan-report/2605051850_E2E_Backend_Gate_Decision.md`
- `plan-report/2605051850_E2E_External_Smoke_Decision.md`
- `plan-report/2605051850_E2E_Auth_Data_Fixture_Decision.md`
- `plan-report/2605051850_E2E_Real_Integration_Upgrade_Report.md`
