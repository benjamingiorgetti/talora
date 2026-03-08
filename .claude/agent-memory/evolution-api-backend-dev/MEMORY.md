# Evolution API Backend Dev - Memory

## Project Architecture
- **Monorepo**: Bun workspaces with `apps/backend`, `apps/frontend`, `packages/shared`
- **Backend**: Express + TypeScript on Bun, port 3001
- **DB**: PostgreSQL 16 (Docker), connection via `pg` library
- **AI**: Anthropic SDK `@anthropic-ai/sdk` v0.39
- **Config**: `apps/backend/src/config.ts` - centralized env var access with `requireEnv()`/`optionalEnv()`

## Key File Paths
- Entry point: `apps/backend/src/index.ts`
- Config: `apps/backend/src/config.ts`
- DB pool: `apps/backend/src/db/pool.ts`
- DB migrations: `apps/backend/src/db/migrate.ts`
- Evolution API client: `apps/backend/src/evolution/client.ts`
- Webhook handler: `apps/backend/src/evolution/webhook.ts`
- AI agent logic: `apps/backend/src/agent/index.ts`
- Tool executor: `apps/backend/src/agent/tool-executor.ts`
- WebSocket server: `apps/backend/src/ws/server.ts`
- API routes: `apps/backend/src/api/` (auth, agents, conversations, instances, alerts, google-auth)
- Shared types: `packages/shared/src/index.ts`

## Database Schema
Tables: `whatsapp_instances`, `agents`, `prompt_sections`, `tools`, `conversations`, `messages`, `bot_config`, `alerts`
- All use UUID PKs with `gen_random_uuid()`
- Conversations have unique index on `(instance_id, phone_number)`
- Messages indexed on `(conversation_id, created_at)`

## Shared Types (import from `@bottoo/shared`)
`WhatsAppInstance`, `Agent`, `PromptSection`, `AgentTool`, `Conversation`, `Message`, `Alert`, `BotConfig`, `ApiResponse<T>`, `WsEvent`

## Evolution API
- Version: v2.2.3 (Docker image `atendai/evolution-api:v2.2.3`)
- Port: 8080
- Auth: API key via `EVOLUTION_API_KEY` env var
- Webhook events: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`

## Known Gotchas
- CORS origin default in config.ts was fixed to `http://localhost:3000` (was `5173`)
- Frontend `api.ts` fallback URL was fixed to `http://localhost:3001` (was `4000`)
- Migration script creates alerts index before alerts table - may fail on fresh DB (table creation order issue in SQL)
