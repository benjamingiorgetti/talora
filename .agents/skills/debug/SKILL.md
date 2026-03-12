---
name: debug
description: "Systematic debugging workflow. Checks env vars, service health, logs, network, and code to diagnose issues. Use when something isn't working: 'se me queda cargando', 'failed to fetch', 'QR not working', 'bot not responding'."
user_invocable: true
---

Run a systematic debugging workflow to diagnose the current issue. If the user described a specific problem, focus on that area. Otherwise, run all checks.

Launch **2 agents in parallel** for diagnostics:

## Agent 1: Infrastructure & Environment Checks

### Check 1: Environment Variables
- Read `.env` and compare with `.env.example`
- Flag missing or empty required vars
- Specifically verify:
  - `NEXT_PUBLIC_API_URL` = `http://localhost:3001`
  - `NEXT_PUBLIC_WS_URL` = `ws://localhost:3001`
  - `CORS_ORIGIN` = `http://localhost:3000`
  - `EVOLUTION_API_KEY` matches between `.env` (root) and `apps/backend/.env`

### Check 2: Docker & Services
- Run `docker ps` — are PostgreSQL and Evolution API containers running?
- Check container logs for errors: `docker logs <container> --tail 20`
- Test database connection: `docker exec <postgres-container> pg_isready`
- Test Evolution API: `curl -s http://localhost:8080/instance/fetchInstances -H "apikey: <key>"`

### Check 3: Port Availability
- Check ports 3000, 3001, 5432, 8080 with `lsof -i :<port> -t`
- Flag conflicts (e.g., another process on port 3001)

### Check 4: Backend Health
- `curl -s http://localhost:3001/api/health` — check DB and Evolution API status
- If backend is not running, check for crash logs

## Agent 2: Code & Network Analysis

### Check 5: Recent Changes
- `git diff --stat HEAD~3` — what changed recently?
- Check if recent changes could explain the issue

### Check 6: TypeScript Errors
- `cd apps/backend && bunx tsc --noEmit 2>&1 | head -30`
- `cd apps/frontend && bunx tsc --noEmit 2>&1 | head -30`

### Check 7: Frontend-Backend Connectivity
- Read `apps/frontend/src/lib/api.ts` — verify BASE_URL
- Check browser console errors (ask user to share if needed)
- Verify CORS configuration in `apps/backend/src/config.ts`

### Check 8: WebSocket Connection
- Verify WS server is initialized in `apps/backend/src/ws/server.ts`
- Check `NEXT_PUBLIC_WS_URL` in frontend

## Diagnosis Report

After both agents complete, produce:

```
DEBUG REPORT
============
Issue: [user's reported problem or "General health check"]

Findings:
  [PASS] Environment variables configured correctly
  [FAIL] Evolution API container not running
  [PASS] Database connection OK
  ...

Root Cause: [most likely cause based on findings]

Recommended Fix:
  1. [step-by-step fix instructions]
  2. ...

Quick Fix Command:
  [single command to try first, if applicable]
```
