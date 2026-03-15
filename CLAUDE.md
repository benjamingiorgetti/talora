# Talora

Plataforma multiempresa de turnos por WhatsApp. No es solo tatuajes.

## What Matters Now

Leer `todos.md` antes de arrancar trabajo nuevo.
Si modificas un todo en todos.md, actualiza luego para que quede actualizado lo que ya esta hecho.

## Bug Rule

Cuando reporto un bug, NO arrancar a fixearlo directo. Orden:

1. Escribir un test que reproduzca el bug
2. Lanzar subagentes para fixearlo
3. Probar que pasa el test

## Agentes y Paralelismo

- Usar libremente todos los agentes y skills disponibles. Sin límites artificiales.
- Si una tarea se beneficia de paralelismo, lanzar múltiples agentes en paralelo sin restricción de cantidad.
- Usar la skill correcta para cada dominio: UI/UX → skills de UI/UX, backend → skills de backend, OAuth → agente de integraciones, etc. No esperar a que el usuario lo pida explícitamente.
- Si el trabajo toca frontend, backend, integraciones, y UX al mismo tiempo, lanzar un agente por cada área en paralelo.
- Priorizar velocidad y especialización: cada agente/skill existe para algo, usarlo.

## Principios de Trabajo

1. No bajar la vara por usar LLMs. Si una feature no es claramente valiosa, no se shippea.
2. Decisiones de shipping no se toman en soledad. Si hay duda, alinear con el core team.
3. Prototipo no gana contra pensamiento de producto: primero el porqué, después el cómo.
4. Si el diseño original quedó mal, se refactoriza. Dejar el código mejor que como estaba.
5. Más valor en limpiar y mejorar lo existente que en perseguir la próxima feature.

## Stack (non-obvious)

- Bun workspaces, NOT Node
- OpenAI SDK (`gpt-4o-mini`), NOT Anthropic — for the conversational agent
- Evolution API v2.3.7 for WhatsApp (runs in Docker)
- Google Calendar = source of truth for appointments
- PostgreSQL on port 5433, raw SQL (no ORM) — schema in `apps/backend/src/db/migrate.ts`
- Three apps: `backend` (Express:3001), `frontend` (Next.js:3000), `landing` (Next.js:3002)
- Shared types: `packages/shared/src/index.ts` as `@talora/shared`

## Architecture

Backend (`apps/backend/src/`):
- `api/` — Express route handlers (one file per domain)
- `agent/` — OpenAI conversational agent (prompt-builder, tool-executor, runtime)
- `evolution/` — WhatsApp client & webhook handler
- `calendar/` — Google Calendar operations
- `db/` — PostgreSQL pool, migrations, query helpers
- `auth/` — JWT middleware, Google OAuth
- `ws/` — WebSocket server

Auth: JWT with roles `superadmin | admin_empresa | professional`. Multi-tenant by `company_id`.

## Commands

- Backend dev: `cd apps/backend && bun run dev`
- Frontend dev: `cd apps/frontend && bun run dev`
- Landing dev: `cd apps/landing && bun run dev`
- Migrations: `cd apps/backend && bun run migrate`
- Backend typecheck: `cd apps/backend && bun run typecheck`
- Frontend lint: `cd apps/frontend && bun run lint`
- Frontend build: `cd apps/frontend && bun run build`
- Full environment: `/launch` skill

## Env Gotchas

- Root `.env` needs `EVOLUTION_API_KEY`; must match `apps/backend/.env` and `docker-compose.yml`.
- `WEBHOOK_BASE_URL=http://host.docker.internal:3001` — NOT localhost. Evolution container can't reach localhost.
- `CORS_ORIGIN=http://localhost:3000`, `NEXT_PUBLIC_API_URL=http://localhost:3001`, `NEXT_PUBLIC_WS_URL=ws://localhost:3001`.
- Docker Desktop must be running before `docker-compose up -d`.
- If port 3001 is busy, check for a stale backend process before changing code.

## Domain Rules

- `calendar_connected` means the company has real mapped calendars for active professionals, NOT just "OAuth exists".
- One Google Calendar per professional. Use `GET /auth/google/calendars?company_id=...` for real options, never free text.
- `qr_pending` is a valid WhatsApp state, not an error. Poll until `connected`.
- "Implemented" and "vendible" are different. Prefer proving real flows over adding surfaces.

## Debugging Playbook

- **Blank page**: auth/redirect → `/_next/static/*` assets → restart frontend → check hydration (e.g., `button > button`)
- **Evolution/WhatsApp**: container health → `GET /instances` → `GET /instances/:id/qr` → webhook reachability
- **General**: env vars → docker/ports → backend logs → then code
- Use `/debug` skill for systematic checks. Use `/status` for quick health dashboard.

## Security

- NEVER accept pasted API keys or secrets in chat. Always reference .env files.
- Do not commit .env, credentials.json, or files with secrets.

## Testing

- Framework: `bun:test` with `run-tests.sh` for isolated per-file execution
- Run: `cd apps/backend && bun run test`
- Single file: `cd apps/backend && bun test src/path/to/file.test.ts`
- Coverage: `cd apps/backend && bun run test:coverage`
- Helpers: `apps/backend/src/__test-utils__/`
- CI: `.github/workflows/test.yml` (tests) + `ci.yml` (typecheck + lint + build) on push/PR

## Code Style

- In React components, declare all functions BEFORE any `useEffect` that references them and BEFORE any early return. Prevents Temporal Dead Zone crashes.

## Skills

- `/launch` — start full dev environment (env, docker, migrations, servers)
- `/debug` — systematic debugging (env → docker → logs → code)
- `/status` — quick health dashboard (ports, containers, backend, Evolution)
- `/test-bug` — reproduce bug as test first, then fix with subagents
- `/preflight` — pre-implementation env/dependency check
- `/browse` — headless browser for QA (from gstack)
- `/qa` — systematic QA testing

## Session Learnings

- If a Next.js page is blank, do not assume the route code is the problem first.
  1. Check auth/redirect state
  2. Check `/_next/static/*` asset responses
  3. Restart `cd apps/frontend && bun run dev`
  4. Then inspect route-specific render/hydration issues

## gstack

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

If gstack skills aren't working: `cd .claude/skills/gstack && ./setup`
