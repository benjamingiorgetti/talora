---
name: preflight
description: "Run pre-implementation diagnostics for bottoo. Checks env vars, dependencies, Docker, ports, type-checking, and URL alignment between frontend and backend."
user_invocable: true
---

Run all diagnostic checks and produce a status report. Do NOT start any servers - this is read-only diagnostics.

## Check 1: Environment Variables
Read `.env` and `.env.example`. Report:
- Missing `.env` file
- Keys present in `.env.example` but missing or empty in `.env`
- Specifically flag if `NEXT_PUBLIC_API_URL` is NOT set to `http://localhost:3001`

## Check 2: Dependencies
Check if `node_modules` exists in root, `apps/backend`, and `apps/frontend`.
If missing, report that `bun install` needs to run.

## Check 3: Docker Containers
Run `docker-compose ps` and report container status.
Flag if PostgreSQL or Evolution API containers are not running.

## Check 4: Port Availability
Check if ports 3000, 3001, 5432, 8080 are in use: `lsof -i :PORT -t` for each.
Report what's running on each port.

## Check 5: Frontend-Backend URL Alignment
Read `apps/frontend/src/lib/api.ts` and verify the BASE_URL fallback.
Read `apps/backend/src/config.ts` and verify the CORS origin.
Flag any mismatches between:
- Frontend API URL and backend port (should be 3001)
- CORS origin and frontend port (should be 3000)

## Check 6: TypeScript Compilation
Run `cd apps/backend && bunx tsc --noEmit 2>&1 | head -20` and report errors.
Run `cd apps/frontend && bunx tsc --noEmit 2>&1 | head -20` and report errors.

## Report
Print a clear status report with pass/fail for each check:
```
PREFLIGHT REPORT
================
[PASS/FAIL] Environment variables
[PASS/FAIL] Dependencies installed
[PASS/FAIL] Docker containers running
[PASS/FAIL] Ports available/correct
[PASS/FAIL] Frontend-Backend URL alignment
[PASS/FAIL] TypeScript compilation

Blockers: (list any FAIL items that must be fixed before development)
```
