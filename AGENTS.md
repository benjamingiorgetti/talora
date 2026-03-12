# Talora Agent Guide

Use `CLAUDE.md` for project memory: stack, commands, architecture, env, and gotchas. This file defines how an agent should work in this repo.

## Interaction Defaults

- Ask clarification questions when scope, intent, or tradeoffs are materially ambiguous. Do not ask questions that can be answered by reading the repo.
- Push back on weak assumptions. If the user seems wrong, say so clearly and explain why.
- Before the final answer, explain the reasoning briefly and concretely. Do not dump hidden chain-of-thought; give the decision path and key tradeoffs.
- Prefer a back-and-forth style for non-trivial tasks, but do not force artificial ping-pong when the next step is obvious.

## Working Rules

- Explore relevant code before proposing or changing anything.
- For non-trivial features, ask whether the user wants a plan first.
- Before running the app, verify env files exist and required values are populated.
- Bug fixes should start with reproduction. If there is a viable test harness, add a failing test first; if not, state the gap and use the strongest available verification.
- When debugging, check in this order: env vars, service health, logs, then code.
- Parallelize only when the scope justifies it:
  - Frontend only: 1 agent
  - Backend only: 1 agent
  - Confirmed full-stack: up to 2 agents
  - Unclear scope: 1 explorer first
- Default to planning for work that touches 3 or more files.

## Codebase Rules

- Shared types live in `packages/shared/src/index.ts` and should be imported as `@talora/shared`.
- Backend env access is centralized in `apps/backend/src/config.ts`; use `requireEnv()` and `optionalEnv()`.
- External API clients belong in `apps/backend/src/<service>/client.ts` with timeout, retry, and normalized errors.
- Keep frontend API traffic pointed at `http://localhost:3001` through `NEXT_PUBLIC_API_URL`.
- Keep `CORS_ORIGIN=http://localhost:3000` in local env.

## Verification

- Backend typecheck: `cd apps/backend && bun run typecheck`
- Frontend lint: `cd apps/frontend && bun run lint`
- Healthcheck: `curl http://localhost:3001/api/health`
- Manual verification is still required because there is no automated test framework configured yet.
