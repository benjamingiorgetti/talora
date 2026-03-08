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
- `components/agent/` - Agent config tabs (alerts, calendar, conversations, prompt-editor, tools-tab, + prompt editor suite)
  - `prompt-editor-tab.tsx` — unified single-prompt editor (backdrop+textarea highlight technique, env toggle, right panel)
  - `variables-panel.tsx` — right panel listing system/custom variables with insert, copy, CRUD
  - `test-chat-panel.tsx` — right panel test chat with session lifecycle
  - `save-discard-bar.tsx` — fixed bottom bar (slide-up AnimatePresence)
  - `environment-toggle.tsx` — segmented Produccion/Test control
  - `resolved-view.tsx` — read-only resolved prompt fetched from `/agent/prompt-preview`
  - DELETED: `prompt-section-editor.tsx`, `sections-tab.tsx` — removed in unified prompt refactor
- `hooks/use-prompt-editor.ts` — hook managing single prompt string; fetches `GET /agent/prompt`, saves via `PUT /agent/prompt`
- `components/navbar.tsx` - Navigation bar (includes WsConnectionStatus)
- `components/ws-connection-status.tsx` - WebSocket status pill + reconnect banner
- `components/error-boundary.tsx` - Error boundary wrapper

## UI Libraries Installed
- Radix UI: dialog, label, scroll-area, separator, slot, switch, tabs
- class-variance-authority for variant styles
- clsx + tailwind-merge (via `cn()` utility)
- SWR for data fetching
- Sonner for toasts
- Framer Motion for animations

## Shared Types (import from `@talora/shared`)
`WhatsAppInstance`, `Agent`, `PromptSection`, `AgentTool`, `Conversation`, `Message`, `Alert`, `BotConfig`, `ApiResponse<T>`, `WsEvent`, `Variable`, `TestSession`, `TestMessage`

## Highlighted Textarea Technique
- Used in `prompt-editor-tab.tsx` for inline `{{variable}}` highlighting with zero extra deps
- Pattern: `position:relative` container, `position:absolute inset-0` backdrop div (pointer-events:none) renders styled JSX, transparent `<textarea>` on top with `caretColor` set to foreground
- Sync scroll: `onScroll` on textarea copies `scrollTop/scrollLeft` to backdrop ref via `requestAnimationFrame`
- `highlightVariables(text)` splits on `/({{[^}]*}})/g` and wraps matches in `<mark style={{all:"unset",...}}>` (inline style needed to override browser mark defaults)

## API Client Conventions (api.ts)
- `fetcher(path)` unwraps `{ data: T }` — only use for endpoints that return `{ data: ... }`
- `api.get<T>(path)` returns raw response — use for endpoints that return data directly (e.g. `/auth/google/status`)
- GET timeout: 10_000ms via `AbortSignal.timeout()`
- Mutation timeout (POST/PUT/DELETE/PATCH): 30_000ms
- Fallback BASE_URL: `http://localhost:3001` (was wrong 4000 — fixed)
- Errors bubble as thrown `Error` instances with `.message` from JSON body
- Health endpoint `/api/health` is PUBLIC — use bare `fetch()`, not `api.get()` (no auth token needed)

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

## Animation Patterns (framer-motion)
- Motion variants live in `apps/frontend/src/lib/motion.ts`
- **Only 3 exports**: `transition.default` (150ms easeOut), `fadeIn` (opacity-only), `pageTransition` (opacity-only)
- DEAD — do NOT import: `fadeInUp`, `scaleIn`, `slideInLeft`, `staggerContainer`, `staggerItem`
- Tab transitions: `AnimatePresence mode="wait"` + `key={activeTab}` + `fadeIn` variants
- Lists: plain `<div>` wrappers — no stagger
- `useSearchParams()` requires wrapping the component in `<Suspense>` when used in a page context

## Design System (Units 2–4 — restraint philosophy)
- **Navbar**: `bg-background border-b border-border`, height `h-14`, no glass, no gradient text
- **Brand name in nav**: `text-foreground font-semibold text-base tracking-tight` (plain, no gradient)
- **Active nav item**: `bg-accent text-foreground` (no primary color border/tinted background)
- **Logout button**: `text-muted-foreground hover:text-destructive hover:bg-transparent`
- **Card**: `rounded-lg border border-border bg-card` — no shadow, full-opacity border
- **Button base**: `transition-colors`, `focus-visible:ring-1 focus-visible:ring-ring`, no shadow
- **Dialog overlay**: `bg-black/60 backdrop-blur-[2px]`
- **Dialog content**: `rounded-lg` (not rounded-2xl), no shadow-lg
- **Sidebar**: `bg-card border border-border rounded-lg` — active item: `bg-accent text-foreground rounded-md`
- **WS status indicator**: static colored dot (no pulse-success/warning classes), plain text, no pill wrapper
- **WS disconnection banner**: `bg-card border border-destructive/30 rounded-lg`, no backdrop-blur, no shadow
- **Dashboard layout**: plain `<main py-6>`, no framer-motion page wrapper
- **Dark-mode badge colors**: `bg-{color}-500/10 text-{color}-400 border-{color}-500/20`
- **Alert colors**: `bg-red-500/10 border-l-red-500`, `bg-yellow-500/10 border-l-yellow-500`, `bg-blue-500/10 border-l-blue-500`
- **Chat bubbles**: user → `bg-accent border border-border`, bot → `bg-primary/15 border border-primary/20`
- **Avatar palette**: `bg-{color}-500/15 text-{color}-400` (dark-mode safe — avoid light -100/-700 pairs)
- **Add/CTA buttons**: `border-dashed border-border hover:bg-accent/50 text-muted-foreground`
- Philosophy: flat borders define hierarchy — no glass, shimmer, gradient text, pulsing dots, hover-lift, stagger

## CSS Utilities (globals.css)
- `.glass` — glassmorphism card background (blur + semi-transparent)
- `.pulse-success` — green pulsing glow (for connected status dots)
- `.pulse-warning` — yellow pulsing glow
- `.pulse-primary` — blue pulsing glow
- `.shimmer-bg` — shimmer loading effect
- `.hover-lift` — translateY(-2px) + shadow on hover
- `.text-gradient-primary` — blue gradient text

## Known Gotchas
- ESLint is not configured in the frontend — use `bunx tsc --noEmit` for type checking
- Backend API routes have NO `/api` prefix — paths like `/agents`, `/instances`, `/auth/login`
- Exception: health check IS at `/api/health` (public, no auth required)
- Auth uses JWT in localStorage, auto-redirects to `/login` on 401
- Pre-existing QR `<img>` tag triggers Next.js warning about `next/image` — not our code, don't fix unless asked
