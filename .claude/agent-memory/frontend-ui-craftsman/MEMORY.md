# Frontend UI Craftsman - Memory

## Project Architecture
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + shadcn/ui components + tailwindcss-animate
- **Icons**: Lucide React
- **Data fetching**: SWR with custom `fetcher` from `lib/api.ts`
- **Notifications**: Sonner (configured in providers.tsx — Nunito font, borderRadius 16px, richColors)
- **Port**: 3000

## Key File Paths
- App layout: `apps/frontend/src/app/layout.tsx`
- Dashboard layout: `apps/frontend/src/app/(dashboard)/layout.tsx`
- Dashboard home: `apps/frontend/src/app/(dashboard)/page.tsx`
- Agent config page: `apps/frontend/src/app/(dashboard)/agent/page.tsx`
- Login page: `apps/frontend/src/app/login/page.tsx`
- API client: `apps/frontend/src/lib/api.ts`
- Auth context: `apps/frontend/src/lib/auth.tsx`
- Utils (cn): `apps/frontend/src/lib/utils.ts`
- WebSocket hook: `apps/frontend/src/hooks/useWebSocket.ts`
- Providers: `apps/frontend/src/app/providers.tsx`
- Global CSS: `apps/frontend/src/app/globals.css`
- Navbar: `apps/frontend/src/components/navbar.tsx`
- WS status indicator: `apps/frontend/src/components/ws-connection-status.tsx`

## Component Structure
- `components/ui/` - shadcn/ui primitives (button, card, dialog, input, label, tabs, table, badge, error-card, loading-spinner)
- `components/agent/` - Agent config tabs (alerts, conversations, prompt-editor, sections-tab, tools-tab)
- `components/navbar.tsx` - Navigation bar (includes WsConnectionStatus)
- `components/ws-connection-status.tsx` - WebSocket status pill + reconnect banner
- `components/error-boundary.tsx` - Error boundary wrapper

## UI Libraries Installed
- Radix UI: dialog, label, scroll-area, separator, slot, switch, tabs
- class-variance-authority for variant styles
- clsx + tailwind-merge (via `cn()` utility)
- SWR for data fetching
- Sonner for toasts

## Shared Types (import from `@bottoo/shared`)
`WhatsAppInstance`, `Agent`, `PromptSection`, `AgentTool`, `Conversation`, `Message`, `Alert`, `BotConfig`, `ApiResponse<T>`, `WsEvent`

## API Client Conventions (api.ts)
- GET timeout: 10_000ms via `AbortSignal.timeout()`
- Mutation timeout (POST/PUT/DELETE/PATCH): 30_000ms
- Fallback BASE_URL: `http://localhost:3001` (was wrong 4000 — fixed)
- Errors bubble as thrown `Error` instances with `.message` from JSON body

## WebSocket Hook (useWebSocket.ts)
- Fallback WS_URL: `ws://localhost:3001/ws` (was wrong 4000 — fixed)
- Returns: `{ lastEvent, isConnected, retriesExhausted, reconnect }`
- `reconnect()` resets retry counter and triggers immediate reconnect
- MAX_RETRIES = 10, exponential backoff with jitter up to 30s

## SWR Config (providers.tsx)
- `dedupingInterval`: 5000ms, `revalidateOnFocus`: true, `revalidateOnReconnect`: true

## Mutation Pattern (sections-tab, tools-tab)
- Wrap mutations in try-catch, use `toast.success()` / `toast.error()` (Sonner)
- Track per-item loading with `useState<string | null>` storing the item ID
- Disable buttons/switches during mutation, show inline loading text

## Accessibility Conventions
- Icon-only buttons must have `aria-label` in Spanish describing the action
- Toggle/expand buttons use `aria-expanded`
- Status indicators use `role="status"` + `aria-live="polite"`
- Error/warning banners use `role="alert"`
- Decorative icons get `aria-hidden="true"`

## Known Gotchas
- ESLint is not configured in the frontend — use `bunx tsc --noEmit` for type checking
- Backend API routes have NO `/api` prefix — paths like `/agents`, `/instances`, `/auth/login`
- Auth uses JWT in localStorage, auto-redirects to `/login` on 401
