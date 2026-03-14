# Talora

Plataforma multiempresa de turnos por WhatsApp. No es solo tatuajes.

## What Matters Now

Leer `todos.md` antes de arrancar trabajo nuevo. Prioridad MVP:

1. Google Calendar real por profesional
2. WhatsApp / Evolution real con QR usable
3. Flujo end-to-end sobre una empresa demo
4. QA manual del MVP vendible

## Bug Rule

Cuando reporto un bug, NO arrancar a fixearlo directo. Orden:

1. Escribir un test que reproduzca el bug
2. Lanzar subagentes para fixearlo
3. Probar que pasa el test

## Principios de Trabajo

1. No bajar la vara por usar LLMs. Si una feature no es claramente valiosa, no se shippea.
2. Decisiones de shipping no se toman en soledad. Si hay duda, alinear con el core team.
3. Prototipo no gana contra pensamiento de producto: primero el porqué, después el cómo.
4. Si el diseño original quedó mal, se refactoriza. Dejar el código mejor que como estaba.
5. Más valor en limpiar y mejorar lo existente que en perseguir la próxima feature.
6. Velocidad real > gratificación inmediata. Usar agentes no debe erosionar el criterio.

## Stack (non-obvious)

- Bun workspaces, NOT Node
- OpenAI SDK (`gpt-4o-mini`), NOT Anthropic — for the conversational agent
- Evolution API v2.2.3 for WhatsApp (runs in Docker)
- Google Calendar = source of truth for appointments
- Shared types: `packages/shared/src/index.ts` as `@talora/shared`

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
- CI: `.github/workflows/test.yml` (typecheck + tests on push/PR)

## Skills

- `/launch` — start full dev environment (env, docker, migrations, servers)
- `/debug` — systematic debugging (env → docker → logs → code)
- `/status` — quick health dashboard (ports, containers, backend, Evolution)
- `/test-bug` — reproduce bug as test first, then fix with subagents
- `/preflight` — pre-implementation env/dependency check
- `/browse` — headless browser for QA (from gstack)
- `/qa` — systematic QA testing

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

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

If gstack skills aren't working: `cd .claude/skills/gstack && ./setup`
