# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3.0] - 2026-03-16

### Added
- Calendar temporal awareness: past appointments dimmed (opacity + gray tones), current appointment highlighted with "Ahora" badge and pulse animation
- `getAppointmentTimeState` utility with unit tests (past/now/future detection)
- Vercel Analytics integration on landing page
- Auto-copy `.env` from canonical repo in `/launch` skill for Conductor worktrees
- Message buffer/debounce for WhatsApp bot: waits 10s for user to finish typing before responding, preventing fragmented per-message responses
- Max buffer window (30s) to prevent starvation when messages arrive continuously
- Buffer cancellation on /reset command and bot_paused re-check at invocation time
- Configurable buffer delays via `MESSAGE_BUFFER_DELAY_MS` and `MESSAGE_BUFFER_MAX_WINDOW_MS` env vars
- 7 new tests covering buffer batching, reset cancellation, bot_paused mid-flight, max window, and agent-processing overlap
- Client analytics KPI cards on detail view: último turno, ticket promedio, frecuencia, total turnos, revenue total, mensajes enviados, tasa de respuesta, tasa de conversión
- `GET /clients/:id/analytics` endpoint combining `client_analytics`, preferred day of week, and per-client reactivation stats
- `ClientDetailAnalytics` shared type in `@talora/shared`
- 9 unit tests for the analytics endpoint (0/1/3+ appointments, DOW mapping, division safety, auth scoping)

### Changed
- Reuse existing `status-pulse` animation instead of duplicating keyframes
- Updated CLAUDE.md with worktree `.env` documentation

### Fixed
- CRM/Growth view now shows ALL active clients, not just those with 2+ appointments — rewrote `computeClientAnalytics()` to start from `clients` table with LEFT JOIN to appointments
- Backlog cleanup: moved AGENT-1, AGENT-2, QA-CAL to Done (verified in code); removed obsolete MVP-4/6/7/8/9a/11; reordered by priority

### Removed
- 16 custom agent definitions (replaced by gstack agents)
- 14 non-essential skills (architecture-review, audit, debug, integrate, plan-deep, preflight, refactor, rename, retro, setup-browser-cookies, status, test-bug, todo, ultra-think)
- `.agent/` directory (duplicate of `.agents/`)

## [1.0.2.0] - 2026-03-16

### Added
- Create professional modal dialog on professionals settings page with form fields for name, specialty, and calendar ID
- Professionals section header button to create new professionals (visible to superadmin/admin_empresa roles only)

## [1.0.1.0] - 2026-03-15

### Added
- Growth engine: client analytics with risk scoring based on appointment frequency gaps
- Reactivation messaging via WhatsApp with rate limiting (20/day), customizable templates, and conversation thread integration
- Attribution tracking: auto-marks reactivation as "converted" when client books within 7 days
- CRM Kanban view (`/workspace/growth`) with 4 risk columns, search, and send-message modal
- Growth metrics dashboard (`/dashboard/crecimiento`) with ROI stats, monthly chart, and recent messages
- 8 REST endpoints on `/growth/*` for at-risk clients, reactivation, stats, and settings
- 2 new DB tables: `client_analytics`, `reactivation_messages`
- `company_settings` extensions for reactivation configuration
- EventEmitter (`events.ts`) for decoupled appointment-created events
- 64 new tests across analytics, reactivation, attribution, and API endpoints

### Changed
- Clients page redesigned to table layout for scale
- Sidebar adds CRM navigation item
- Appointment creation now emits events for attribution tracking

## [1.0.0.1] - 2026-03-15

### Changed
- Consolidated parallelism rules from AGENTS.md to CLAUDE.md for single source of truth
- Removed artificial parallelization constraints to match flexible agent usage policy

