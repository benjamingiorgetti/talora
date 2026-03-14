# Talora

Talora ya no debe pensarse solo como producto para tatuajes. El estado actual del repo es una plataforma multiempresa de turnos por WhatsApp. Este archivo es memoria de proyecto; usar `AGENTS.md` para comportamiento y policy del agente.

## Stack / Overview

- Monorepo on Bun workspaces: `apps/*`, `packages/*`
- Backend: Express + TypeScript on Bun in `apps/backend` on port `3001`
- Frontend: Next.js 14 + Tailwind + shadcn/ui in `apps/frontend` on port `3000`
- Shared types: `packages/shared/src/index.ts` imported as `@talora/shared`
- Infra: Docker Compose with PostgreSQL 16 + Evolution API v2.2.3
- AI: OpenAI SDK (`openai` v4.x, default model `gpt-4o-mini`)
- Optional integration: Google Calendar via `googleapis`

## Current Product State

- Talora tiene dos experiencias separadas:
  - `superadmin`: configura empresas, integraciones, profesionales y servicios
  - `admin_empresa`: opera su workspace cliente
- Superficies principales:
  - `superadmin`: `/superadmin/companies`
  - `cliente`: `/workspace`, `/workspace/calendar`, `/workspace/whatsapp`, `/workspace/appointments`, `/workspace/clients`
- `/agent` sigue existiendo, pero es consola interna/técnica. No es la UX principal del cliente.
- Modelo actual:
  - multiempresa (`companies`)
  - roles `superadmin` y `admin_empresa`
  - un workspace por empresa
  - Google Calendar como fuente de verdad de turnos
  - Evolution API para WhatsApp

## Current MVP Priorities

Seguir este orden antes de agregar features:

1. Google Calendar real por profesional
2. WhatsApp / Evolution real con QR usable
3. Flujo end-to-end sobre una empresa demo
4. QA manual del MVP vendible

Antes de arrancar trabajo nuevo, leer `todos.md`.

## Principios de Trabajo (Himno Talora)

1. No bajar la vara por usar LLMs. Si una feature no es claramente valiosa, no se shippea.
2. Decisiones de shipping no se toman en soledad. Si hay duda, alinear con el core team.
3. Prototipo no gana contra pensamiento de producto: primero el porqué, después el cómo.
4. Si el diseño original quedó mal, se refactoriza. Dejar el código mejor que como estaba.
5. Más valor en limpiar y mejorar lo existente que en perseguir la próxima feature.
6. Velocidad real > gratificación inmediata. Usar agentes no debe erosionar el criterio.

## Project-Specific Skills

- `talora-mvp-qa`: usar para validar si algo del MVP realmente funciona de punta a punta o para preparar una demo company
- `talora-live-debug`: usar para pantallas en blanco, cargas infinitas, problemas de Google Calendar/Evolution o estados operativos engañosos

## Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install workspace dependencies |
| `cp .env.example apps/backend/.env` | Create backend env file |
| `echo "EVOLUTION_API_KEY=dev-api-key" > .env` | Create root env for Docker Compose |
| `docker-compose up -d` | Start PostgreSQL + Evolution API |
| `cd apps/backend && bun run migrate` | Run DB migrations |
| `cd apps/backend && bun run dev` | Start backend on `3001` |
| `cd apps/frontend && bun run dev` | Start frontend on `3000` |
| `cd apps/backend && bun run typecheck` | Validate backend TypeScript |
| `cd apps/frontend && bun run lint` | Lint frontend |
| `curl http://localhost:3001/api/health` | Check backend health |

## Architecture / Key Files

- `apps/backend/src/index.ts`: Express entrypoint, route mounting, CORS, healthcheck, WebSocket bootstrap
- `apps/backend/src/config.ts`: centralized env loading via `requireEnv()` and `optionalEnv()`
- `apps/backend/src/agent/index.ts`: OpenAI agent orchestration
- `apps/backend/src/agent/tool-executor.ts`: agent tool execution
- `apps/backend/src/cache/agent-cache.ts`: cached agent configuration
- `apps/backend/src/evolution/client.ts`: Evolution API HTTP wrapper
- `apps/backend/src/evolution/webhook.ts`: inbound WhatsApp webhook handling
- `apps/backend/src/ws/server.ts`: WebSocket broadcasting + heartbeat
- `apps/frontend/src/lib/api.ts`: frontend API client; fallback base URL is `http://localhost:3001`
- `packages/shared/src/index.ts`: shared API and domain types

Backend routes worth knowing:
- Public: `/api/health`, `/auth/login`, `/auth/google/*`, `/webhook/*`
- Protected: `/instances`, `/conversations`, `/alerts`, `/agent/sections`, `/agent/tools`, `/clients`, `/companies`, `/appointments`, `/professionals`, `/services`, `/api/agents`

Setup y rutas nuevas importantes:
- `GET /companies`: listado superadmin con overview de setup
- `GET /companies/current`: contexto actual del workspace cliente
- `GET /auth/google/status?company_id=...`: estado de OAuth y mapeo
- `GET /auth/google/calendars?company_id=...`: calendarios reales accesibles + validación por profesional
- `/appointments`: CRUD operativo de turnos
- `/professionals`, `/services`: setup operativo por empresa

## Environment + Gotchas

- Root `.env` must exist with `EVOLUTION_API_KEY`; `docker-compose.yml` interpolates it and must match the backend key.
- Backend runtime env lives in `apps/backend/.env` and is based on `.env.example`.
- `CORS_ORIGIN` must be `http://localhost:3000`.
- `NEXT_PUBLIC_API_URL` must be `http://localhost:3001`.
- `NEXT_PUBLIC_WS_URL` must be `ws://localhost:3001`.
- `WEBHOOK_BASE_URL` should be `http://host.docker.internal:3001` for local Docker; `localhost` will not work from the Evolution API container.
- Shared types belong in `packages/shared/src/index.ts`.
- External API clients belong in `apps/backend/src/<service>/client.ts` with timeout, retry, and normalized errors.
- Docker Desktop must be running before `docker-compose up -d`.
- Test framework: `bun:test` with isolated per-file execution via `run-tests.sh`
- Run tests: `cd apps/backend && bun run test`
- Run single file: `cd apps/backend && bun test src/path/to/file.test.ts`
- Run with coverage: `cd apps/backend && bun run test:coverage`
- Test helpers in `apps/backend/src/__test-utils__/` (factories, mock pool, mock logger, mock request)
- CI: `.github/workflows/test.yml` runs typecheck + tests on push/PR
- `WEBHOOK_BASE_URL=http://host.docker.internal:3001` is the correct local default for Dockerized Evolution. `localhost` inside the container breaks webhooks.
- If port `3001` is busy, inspect the running backend before changing code. A stale live process is common during debugging.

## Google Calendar Notes

- Google Calendar is the source of truth for appointments.
- The current MVP expects one calendar per professional.
- If Google OAuth is already connected, do not accept invented or inaccessible `calendar_id` values.
- Superadmin setup should use `GET /auth/google/calendars?company_id=...` to populate real options, not free text.
- `calendar_connected` is not "OAuth exists"; it should reflect whether the company has real mapped calendars for active professionals.

## WhatsApp / Evolution Notes

- `qr_pending` is a valid operational state, not an automatic error.
- Superadmin setup must show QR/state for the instance and poll until `connected`.
- Before blaming the frontend, verify:
  - Evolution container health
  - instance status in `/instances`
  - QR/state in `/instances/:id/qr`

## Verification Workflow

- After backend or shared TypeScript changes: `cd apps/backend && bun run typecheck`
- After frontend changes: `cd apps/frontend && bun run lint`
- For end-to-end sanity: `curl http://localhost:3001/api/health`, then manually verify frontend on `http://localhost:3000`
- When debugging, check in this order: env vars, running containers/ports, backend logs, then code

## Session Learnings / Repeated Patterns

- If a Next.js page is blank, do not assume the route code is the problem first.
  1. Check auth/redirect state
  2. Check `/_next/static/*` asset responses
  3. Restart `cd apps/frontend && bun run dev`
  4. Then inspect route-specific render/hydration issues
- Route-specific white screens can also come from invalid nested interactive HTML such as `button > button`; check the rendered structure before chasing fetch logic.
- Do not mark work as `Done` in `todos.md` unless it has real validation or objective evidence.
- For this repo, "implemented" and "vendible" are different states. Prefer proving real flows over adding more surfaces.
- Convention: in React components, declare all functions BEFORE any `useEffect` that references them, and BEFORE any early return. `const fn = () => {...}` after an early `if (!x) return` causes a Temporal Dead Zone crash if a `useEffect` above the return references `fn`. Audited 2025-03: 0 violations found, but enforce going forward.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/ship`, `/browse`, `/qa`, `/setup-browser-cookies`, `/retro`.

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
