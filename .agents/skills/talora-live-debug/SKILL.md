---
name: talora-live-debug
description: "Debug live Talora failures with repo-specific heuristics. Use when the app is blank, keeps loading, Google Calendar setup does not reflect reality, QR is not appearing, WhatsApp does not connect, or a route seems broken but the cause may be env, ports, stale Next assets, hydration, or integration state."
user_invocable: true
---

Run a Talora-specific live debugging workflow. This skill exists because generic debugging is not enough for the recurring failures in this repo.

## Use this skill when

- A route is blank or stuck loading
- The user says "no carga la pantalla"
- Google Calendar setup looks connected but does not actually work
- QR does not show or WhatsApp does not connect
- `setup_ready` or `calendar_connected` seem wrong

## First principle

Do not start by changing UI code. Prove whether the failure is:

1. auth / redirect
2. stale Next dev assets
3. port/process conflict
4. integration/API state
5. route-level render or hydration bug

## Workflow

### 1. Reproduce exactly

- Capture the exact route, API call, or user action
- Reproduce before editing

### 2. Check infra before code

- Verify env assumptions from `CLAUDE.md`
- `docker ps`
- `lsof -i :3000 -i :3001 -i :8080 -i :5432`
- `curl http://localhost:3001/api/health`

If `3001` is already occupied, inspect the live backend before trying to start another one.

### 3. If the frontend route is blank

- Check auth/session/redirect behavior first
- Check `/_next/static/*` responses for 404s
- Restart `cd apps/frontend && bun run dev` if the asset graph is stale
- Then inspect route-specific hydration issues
- Specifically look for invalid nested interactive HTML such as `button > button`

### 4. If Google Calendar looks wrong

- Test API directly before changing UI:
  - `GET /auth/google/status?company_id=...`
  - `GET /auth/google/calendars?company_id=...`
- Confirm the `company_id` scope is correct
- Confirm professionals map to calendars that are actually accessible
- Do not trust "connected" labels without endpoint proof

### 5. If WhatsApp / QR looks wrong

- Check Evolution container health
- Check `/instances`
- Check `/instances/:id/connect`
- Check `/instances/:id/qr`
- Treat `qr_pending` as a valid waiting state
- Verify webhook assumptions:
  - local Docker should use `WEBHOOK_BASE_URL=http://host.docker.internal:3001`

### 6. If setup status looks inconsistent

- Inspect company overview counts
- Inspect `calendar_connected`, `setup_ready`, mapped professionals, and connected instances
- Prefer fixing the underlying state logic over patching labels in the UI

## Output format

Return a compact diagnosis report:

```text
TALORA DEBUG REPORT
===================
Issue: ...

Most likely cause:
- ...

Evidence:
- ...

Fix applied:
- ...

Still unproven:
- ...

Next check if it fails again:
- ...
```

## Important reminders

- A white screen is often not a fetch bug.
- A route-specific failure can be a hydration bug even when the rest of the app works.
- In Talora, "integration broken" often looks like a frontend issue first. Prove the API state before touching the UI.
