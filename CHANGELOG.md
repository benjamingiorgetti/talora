# Changelog

All notable changes to this project will be documented in this file.

## [1.0.6.0] - 2026-03-17

### Added
- Appointment reminder system: automatic WhatsApp reminders sent before confirmed appointments
- Reminder scheduler polling every 5 minutes with batch processing (limit 100), rate limit awareness (429 stops cycle), and graceful shutdown
- Configurable per-company: `reminder_enabled`, `reminder_hours_before` (1-48, default 3), `reminder_message_template` with template variables (`{{client_name}}`, `{{service_name}}`, `{{time_description}}`, etc.)
- Smart time descriptions: "hoy a las HH:MM", "manana a las HH:MM", or "el DD/MM a las HH:MM" based on appointment date relative to now
- Timezone-aware formatting with fallback to `America/Argentina/Buenos_Aires`
- DB migration: `reminder_enabled`, `reminder_hours_before`, `reminder_message_template` on `company_settings`; `reminder_sent_at` on `appointments`; partial index for efficient polling
- Frontend reminder settings card in general settings page with toggle, hours input, and custom message textarea with variable chips
- Company settings API validation for `reminder_hours_before` (integer, 1-48 range)
- 23 new tests: 17 for scheduler (send, rate limit, batch update, custom/default template, multi-company, error handling) + 6 for settings API

### Changed
- Renamed `sendReactivationMessage` to `sendOutboundMessage` across codebase for reuse by both reactivation and reminder systems

## [1.0.5.0] - 2026-03-16

### Added
- Slot fill v2: manual review workflow replacing auto-send — cancellations create opportunities with ranked candidates for admin review before messaging
- `slot_fill_opportunities` and `slot_fill_candidates` DB tables with status constraints and indexes
- Candidate selector engine (`slot-fill-selector.ts`) scoring clients by service match, professional match, recency, day-of-week preference, and time-of-day preference
- Manual review actions (`slot-fill-actions.ts`): list pending opportunities, send to candidate, dismiss opportunity
- Atomic candidate claiming with `WHERE status = 'pending' RETURNING id` to prevent duplicate WhatsApp messages on concurrent requests
- Rollback on send failure to restore candidate to pending state
- 3 new API endpoints: `GET /slot-fill/opportunities`, `POST /slot-fill/opportunities/:id/send`, `POST /slot-fill/opportunities/:id/dismiss`
- WebSocket broadcast on new slot fill opportunity creation
- Slot fill settings (enabled, manual_review, max_candidates, message_template) in company_settings
- Frontend opportunity cards with horizontal scroll, candidate list, and send/dismiss actions
- Send modal with editable message text before confirming WhatsApp delivery
- Shared types: `SlotFillOpportunity`, `SlotFillCandidate`, `SlotFillSettings`, `SlotFillOpportunityStatus`, `SlotFillCandidateStatus`
- Comprehensive tests for selector, actions, listener, and API endpoints

### Changed
- Redesigned services settings page: split monolithic component into `ServiceEditorSheet`, `ServicesFilters`, and `ServicesList`
- Replaced inline editing cards with side-panel Sheet for create/edit/delete flows
- Added filtering by status (active/inactive) and professional assignment
- Added sorting by name, price, and duration
- Moved CSV import preview into a modal Dialog instead of inline card
- Created reusable `Sheet` UI component based on Radix Dialog primitives
- Slot fill listener now creates opportunity records instead of auto-sending messages
- Removed `ClientDetailAnalytics` type from shared (moved to inline in client analytics endpoint)

### Fixed
- Duplicate `appointment:confirmed` entry in WsEvent union type replaced with `slot_fill:new_opportunity`

## [1.0.4.0] - 2026-03-16

### Added
- WhatsApp audio message support: voice notes are transcribed via OpenAI Whisper and processed as text with `[Audio]` prefix
- `transcribeAudio()` utility in `apps/backend/src/agent/transcribe.ts` with mime type mapping and base64 handling
- 5 new webhook tests covering audio transcription success, missing base64, empty transcript, API errors, and default mimetype

### Fixed
- Global service creation (`professional_id: null`) rejected by validation schema — added `.nullable()` to `createServiceSchema` to match `updateServiceSchema`

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

