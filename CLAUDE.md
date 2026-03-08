# bottoo

WhatsApp conversational agent for tattoo studios. Admin panel to configure agents, monitor conversations, and manage WhatsApp instances via Evolution API.

## Stack

- **Monorepo**: Bun workspaces (`apps/*`, `packages/*`)
- **Backend**: Express + TypeScript on Bun (`apps/backend/`, port 3001)
- **Frontend**: Next.js 14 + Tailwind + shadcn/ui (`apps/frontend/`, port 3000)
- **Shared types**: `packages/shared/src/index.ts` (imported as `@bottoo/shared`)
- **Infrastructure**: Docker Compose (PostgreSQL 16 + Evolution API v2.2.3)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`)
- **DB**: PostgreSQL, migrations in `apps/backend/src/db/migrate.ts`
- **WebSocket**: `ws` library (`apps/backend/src/ws/server.ts`)
- **Auth**: JWT (`jsonwebtoken`)
- **Calendar**: Google Calendar API (`googleapis`) — optional integration

## How to Run

```bash
# 1. Copy backend env and fill in values
cp .env.example apps/backend/.env

# 2. Create root .env for docker-compose (must match backend EVOLUTION_API_KEY)
echo "EVOLUTION_API_KEY=dev-api-key" > .env

# 3. Install dependencies
bun install

# 4. Start Docker Desktop, then infrastructure
docker-compose up -d

# 5. Run database migrations
cd apps/backend && bun run migrate

# 6. Start backend (port 3001)
cd apps/backend && bun run dev

# 7. Start frontend (port 3000)
cd apps/frontend && bun run dev
```

## Environment Variables

All defined in `.env.example`. Critical ones:
- `DATABASE_URL` - PostgreSQL connection string (default works with docker-compose)
- `JWT_SECRET` - Required for auth, must be set
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` - Admin login credentials
- `EVOLUTION_API_URL` - Default `http://localhost:8080`
- `EVOLUTION_API_KEY` - Required, set in Evolution API container config
- `ANTHROPIC_API_KEY` - Required for AI agent responses
- `NEXT_PUBLIC_API_URL` - Frontend -> Backend URL, must be `http://localhost:3001`
- `NEXT_PUBLIC_WS_URL` - WebSocket URL, must be `ws://localhost:3001`

Optional (Google Calendar integration):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_ID` - Defaults to `primary`

Optional (infrastructure):
- `CORS_ORIGIN` - **Must set to `http://localhost:3000`** (default is `http://localhost:5173` which is wrong for Next.js)
- `WEBHOOK_BASE_URL` - Base URL for webhook registration (default `http://localhost:3001`)
- `WEBHOOK_ALLOWED_HOSTS` - Comma-separated allowed webhook hosts

## Key Conventions

- **ALWAYS launch multiple agents in parallel** for any task. NEVER use a single agent alone. Decompose every task into at least 2 independent sub-tasks and launch them concurrently (e.g., one agent for backend research/changes and another for frontend, or one for exploration and another for implementation planning). This is a hard requirement — no exceptions.
- **Before implementing a new feature**, ask if the user wants a plan first
- **Before running the app**, verify `.env` exists and has all required keys populated
- **Shared types** go in `packages/shared/src/index.ts` - import as `@bottoo/shared`
- **Frontend API URL** must point to `http://localhost:3001` (NOT 4000 or other ports). The fallback in `apps/frontend/src/lib/api.ts` is `localhost:4000` which is WRONG - always set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env`
- **Backend config** is centralized in `apps/backend/src/config.ts` - use `requireEnv()` / `optionalEnv()` helpers
- **CORS origin** defaults to `http://localhost:5173` in config.ts - **set `CORS_ORIGIN=http://localhost:3000` in `.env`**
- After editing TypeScript files, validate types compile: `cd apps/backend && bunx tsc --noEmit`

## Quick Commands

```bash
# Type-check backend
cd apps/backend && bunx tsc --noEmit

# Lint frontend
cd apps/frontend && bun run lint

# Check health
curl http://localhost:3001/api/health
```

## Backend API Routes

Public:
- `GET /api/health` - Health check (DB + Evolution API status)
- `POST /auth/login` - Admin login
- `/auth/google/*` - Google Calendar OAuth flow
- `/webhook/*` - Evolution API webhook receiver

Protected (require JWT):
- `/instances` - WhatsApp instance CRUD
- `/conversations` - Conversation listing
- `/alerts` - Alert management
- `/agent/sections` - Single-tenant prompt sections shortcut
- `/agent/tools` - Single-tenant agent tools shortcut
- `/api/agents` - Full agents CRUD (direct API access)

## Key Files

- `apps/backend/src/index.ts` - Backend entry point, route mounting
- `apps/backend/src/config.ts` - Centralized env config (`requireEnv`/`optionalEnv`)
- `apps/backend/src/evolution/webhook.ts` - WhatsApp message webhook handler
- `apps/backend/src/agent/index.ts` - AI agent logic (Anthropic SDK)
- `apps/frontend/src/lib/api.ts` - Frontend HTTP client (fallback port is wrong, use env var)
- `packages/shared/src/index.ts` - Shared TypeScript types
- `apps/backend/src/evolution/client.ts` - Evolution API HTTP client wrapper
- `apps/backend/src/ws/server.ts` - WebSocket server (heartbeat, broadcasting)
- `apps/backend/src/cache/agent-cache.ts` - Agent config caching layer
- `apps/backend/src/agent/tool-executor.ts` - Agent tool execution logic
- `apps/backend/src/calendar/operations.ts` - Google Calendar slot checking

## Database

PostgreSQL tables: `whatsapp_instances`, `agents`, `prompt_sections`, `tools`, `conversations`, `messages`, `bot_config`, `alerts`

Run migrations: `cd apps/backend && bun run migrate`

## Gotchas

- Root `.env` must exist with `EVOLUTION_API_KEY` — `docker-compose.yml` interpolates it. Without it, the container uses a default key that won't match the backend's key.
- Docker Desktop must be running before `docker-compose up -d`
- No test framework is set up yet — no automated tests exist
- The frontend API fallback port (`localhost:4000`) in `api.ts` is wrong — always set `NEXT_PUBLIC_API_URL` in `.env`

## Custom Agents

- **evolution-api-backend-dev** (Opus): Backend tasks, Evolution API integration, webhook logic
- **frontend-ui-craftsman** (Sonnet): Frontend UI components, animations, dashboard design
