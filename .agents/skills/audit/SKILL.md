---
name: audit
description: "Full codebase quality audit. Launches parallel agents to check backend, frontend, and shared types for type errors, unused code, security issues, and scalability bottlenecks. Produces a consolidated report with severity levels."
user_invocable: true
---

Run a comprehensive codebase quality audit by launching **at least 3 agents in parallel**. Each agent focuses on a different area. Consolidate results into a single report.

## Agent 1: Backend Audit (evolution-api-backend-dev)

Scan `apps/backend/src/` for:
- **Type errors**: Run `cd apps/backend && bunx tsc --noEmit 2>&1` and report all errors
- **Security issues**: SQL injection risks (raw string interpolation in queries), missing input validation on API routes, hardcoded secrets, missing auth middleware on protected routes
- **Scalability bottlenecks**: N+1 query patterns, unbounded loops, missing pagination, large unbounded `SELECT *` queries, missing database indexes for common query patterns
- **Dead code**: Unused exports, unreachable code paths, commented-out code blocks
- **Error handling gaps**: External API calls (Evolution API, Anthropic SDK, Google Calendar) without try/catch, missing error responses to clients
- **Consistency**: Verify all routes use centralized config (`requireEnv`/`optionalEnv`), consistent error response format

## Agent 2: Frontend Audit (frontend-ui-craftsman)

Scan `apps/frontend/src/` for:
- **Type errors**: Run `cd apps/frontend && bunx tsc --noEmit 2>&1` and report all errors
- **Lint issues**: Run `cd apps/frontend && bun run lint 2>&1` and report issues
- **Unused components**: Components imported but never rendered, unused hooks, dead CSS classes
- **API integration issues**: Hardcoded URLs (should use env vars), missing error handling on fetch calls, missing loading states
- **Accessibility**: Missing ARIA labels, non-semantic HTML, missing alt text on images
- **Performance**: Large component re-renders, missing React.memo/useMemo where appropriate, bundle size concerns

## Agent 3: Architecture & Shared Types Audit (general-purpose)

Scan `packages/shared/` and cross-cutting concerns:
- **Type consistency**: Verify types in `packages/shared/src/index.ts` match actual usage in backend and frontend
- **Package.json alignment**: Check workspace dependencies are consistent, no version mismatches
- **Import graph**: Verify no circular dependencies between packages
- **Configuration drift**: Compare `.env.example` with actual env var usage in code — flag any vars used but not documented, or documented but not used
- **Docker/infra**: Check `docker-compose.yml` and Dockerfiles for issues

## Report Format

After all agents complete, produce a consolidated report:

```
CODEBASE AUDIT REPORT
=====================
Date: [current date]

## Critical (must fix)
- [severity: CRITICAL] file:line — description

## Warnings (should fix)
- [severity: WARNING] file:line — description

## Info (nice to have)
- [severity: INFO] file:line — description

## Summary
- Total issues: X (Y critical, Z warnings, W info)
- Areas needing most attention: [list]
- Recommended next steps: [prioritized list]
```
