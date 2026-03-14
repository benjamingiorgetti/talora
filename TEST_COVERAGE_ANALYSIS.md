# Test Coverage Analysis

**Date:** 2026-03-14
**Current coverage:** ~0.5% (1 test file, 245 lines, covering only `tool-executor.ts` guards)

## Current State

### What exists

| File | What it tests |
|------|---------------|
| `apps/backend/src/agent/__tests__/tool-executor.test.ts` | Professional guard (blocks unassigned conversations), appointment ownership filtering on reprogram/cancel, SQL professional_id filter verification |

### What does NOT exist

- No tests for any route handler
- No tests for middleware (auth, RBAC)
- No tests for webhook processing
- No tests for agent orchestration loop
- No tests for prompt building / variable resolution
- No tests for fuzzy matching (service/professional resolution)
- No tests for cache behavior
- No tests for WebSocket broadcasting
- Zero frontend tests
- Zero integration tests
- Zero shared package validation tests

---

## Proposed Test Priorities

Ordered by **risk x impact**. Each section includes what to test, why it matters, and suggested test approach.

---

### P0 — Critical (business-breaking bugs if untested)

#### 1. Webhook Message Processing (`evolution/webhook.ts`)

**Why:** This is the entry point for all WhatsApp messages. A bug here silently drops customer messages.

**What to test:**
- Valid message creates/updates conversation and triggers agent
- Idempotency: duplicate message IDs are ignored
- Auth: requests without valid secret or allowed IP are rejected (401)
- Status-only messages (no text body) are skipped gracefully
- CONNECTION_UPDATE events update instance status in DB
- Unknown event types are ignored without crashing

**Approach:** Unit tests with mocked DB pool and Evolution client. ~15 test cases.

---

#### 2. Tool Executor — Fuzzy Matching (`agent/tool-executor.ts`)

**Why:** The fuzzy matching for services and professionals determines which professional/service gets booked. Wrong match = wrong appointment.

**What to test:**
- Exact name match scores highest
- Partial/token match resolves correctly (e.g., "corte" matches "Corte de pelo")
- Ambiguous names (score < threshold) return error, not a wrong match
- Single-professional company skips matching, uses the only one
- Service aliases are considered during matching
- Case insensitivity and accent handling

**Approach:** Unit tests on `scoreServiceMatch`, `scoreProfessionalMatch`, `resolveServiceSelection`, `resolveProfessionalSelection`. These are pure functions (given mocked DB rows). ~20 test cases.

---

#### 3. Auth Middleware (`api/middleware.ts`)

**Why:** Every protected route depends on this. A bypass = full data exposure across tenants.

**What to test:**
- Valid JWT passes, user context is set on `req`
- Expired/malformed/missing token returns 401
- `requireSuperadmin` blocks non-superadmin roles
- `requireCompanyScope` enforces company isolation
- `getRequestCompanyId` returns correct value for superadmin (query param) vs admin_empresa (token)
- `getRequestProfessionalId` returns correct value per role

**Approach:** Unit tests with mocked `req`/`res`/`next`. Sign real JWTs with test secret. ~12 test cases.

---

#### 4. Multi-tenant Isolation (Route-level)

**Why:** Talora is multi-tenant. A company seeing another company's data is a critical bug.

**What to test:**
- `GET /appointments` for company A does not return company B's appointments
- `GET /clients` scoped correctly
- `GET /conversations` scoped correctly
- Superadmin with `?company_id=X` sees only X's data
- Professional user sees only their own appointments

**Approach:** Integration tests with a real (test) DB, two companies seeded. ~10 test cases.

---

### P1 — High (causes incorrect behavior, hard to catch manually)

#### 5. Agent Orchestration Loop (`agent/index.ts`)

**Why:** The core AI loop. Bugs here cause infinite loops, missed responses, or wrong tool calls.

**What to test:**
- Single-turn message (no tool calls) returns text response
- Tool call → execution → follow-up response works
- Max iterations limit stops infinite tool loops
- Conversation locking prevents concurrent processing of same conversation
- 48h memory window correctly filters old messages
- Error in tool execution is gracefully surfaced to the LLM

**Approach:** Unit tests with mocked OpenAI client and DB. The OpenAI mock returns scripted responses. ~10 test cases.

---

#### 6. Prompt Builder (`agent/prompt-builder.ts`)

**Why:** Variable injection errors cause the AI to hallucinate or leak data from wrong contexts.

**What to test:**
- `{{fechaHoraActual}}` resolves to current datetime
- `{{userName}}`, `{{phoneNumber}}` resolve from conversation context
- Unknown variables are left as-is (not replaced with empty string)
- Security preamble is always prepended
- Empty sections are omitted
- Preview mode returns the resolved prompt without security wrappers

**Approach:** Pure function tests. ~8 test cases.

---

#### 7. Appointment CRUD Route (`api/appointments.ts`)

**Why:** Business-critical. Wrong create/update/cancel = missed appointments, double bookings.

**What to test:**
- Create appointment validates required fields (Zod schema)
- Create appointment calls Google Calendar `bookSlot`
- Reprogram updates both DB and Google Calendar
- Cancel sets status and deletes Google Calendar event
- Overlapping time validation (if implemented)
- Missing `google_event_id` is handled gracefully

**Approach:** Route-level tests with supertest, mocked DB and Calendar. ~12 test cases.

---

#### 8. Google Calendar Operations (`calendar/operations.ts`)

**Why:** Calendar is the source of truth for scheduling. Bugs = double bookings or phantom availability.

**What to test:**
- `checkSlot` returns correct availability for given time range
- `bookSlot` creates event and returns event ID
- `bookSlot` fails gracefully when calendar API is down
- `deleteEvent` handles already-deleted events
- `updateEvent` handles event not found
- Token refresh works when access token is expired

**Approach:** Unit tests with mocked `googleapis` client. ~10 test cases.

---

### P2 — Medium (quality of life, prevents regressions)

#### 9. Validation Schemas (`api/validation.ts`)

**Why:** Prevents malformed data from reaching DB. Currently no tests verify the schemas reject bad input.

**What to test:**
- Each Zod schema rejects invalid input (missing fields, wrong types, too-long strings)
- Each schema accepts valid input
- Edge cases: empty strings, null vs undefined, special characters

**Approach:** Unit tests on Zod schemas directly. ~20 test cases (fast to write).

---

#### 10. Evolution API Client (`evolution/client.ts`)

**Why:** Retry logic and error handling affect message delivery reliability.

**What to test:**
- Successful API call returns parsed response
- 4xx errors are not retried
- Network errors are retried once
- Timeout after 5 seconds
- `sendText` formats payload correctly

**Approach:** Unit tests with mocked fetch. ~8 test cases.

---

#### 11. Agent Cache (`cache/agent-cache.ts`)

**Why:** Stale cache = agent uses old prompt/tools. Cache stampede = performance degradation.

**What to test:**
- Cache miss triggers DB fetch
- Cache hit returns without DB query
- TTL expiration causes refresh
- Concurrent requests deduplicate (no thundering herd)
- `invalidateAgentCache` clears entry

**Approach:** Unit tests with mocked DB and timers. ~6 test cases.

---

#### 12. WebSocket Server (`ws/server.ts`)

**Why:** Real-time updates to the dashboard. Bugs = admin sees stale data or other company's events.

**What to test:**
- Connection requires valid JWT
- Broadcast filters by company_id
- Broadcast filters by professional_id for professional role
- Max connections limit enforced
- Heartbeat terminates unresponsive clients

**Approach:** Integration tests with real WebSocket client, mocked JWT. ~8 test cases.

---

### P3 — Low (nice to have, improves confidence)

#### 13. Config Loading (`config.ts`)
- `requireEnv` throws on missing vars
- Port parsing defaults correctly

#### 14. Shared Types Runtime Validation
- Add Zod schemas mirroring TypeScript types for API boundary validation

#### 15. Frontend Component Tests
- Once backend is solid, add tests for critical frontend flows (login, appointment creation form, calendar view)

---

## Recommended Implementation Order

| Phase | Tests to Add | Estimated Cases | Rationale |
|-------|-------------|-----------------|-----------|
| **Phase 1** | Auth middleware + Validation schemas + Fuzzy matching | ~50 | Pure/unit tests, zero infra needed, highest ROI |
| **Phase 2** | Webhook processing + Evolution client + Prompt builder | ~30 | Still unit tests, covers the WhatsApp entry point |
| **Phase 3** | Agent orchestration + Calendar operations | ~20 | More complex mocking (OpenAI, googleapis) |
| **Phase 4** | Route handlers + Multi-tenant isolation | ~22 | Needs supertest or similar, test DB setup |
| **Phase 5** | WebSocket + Cache + Config | ~16 | Lower risk, can be done incrementally |

**Total: ~138 test cases across 5 phases**

## Infrastructure Needed

The project already has Bun's test runner configured. To proceed:

1. **No new dependencies required** — `bun:test` provides `describe`, `it`, `expect`, `mock`, `beforeEach`
2. **Test DB** — For integration tests (Phase 4), set up a test PostgreSQL via Docker or use the existing one with a separate database
3. **Supertest equivalent** — For route testing, either use `bun`'s built-in fetch against a test server or add a lightweight HTTP test helper
4. **CI integration** — Add `bun test` to the CI pipeline once Phase 1 is complete

## File Organization Convention

Following the existing pattern (`__tests__/` colocated with source):

```
apps/backend/src/
  agent/__tests__/
    tool-executor.test.ts       (exists)
    fuzzy-matching.test.ts      (new)
    prompt-builder.test.ts      (new)
    orchestration.test.ts       (new)
  api/__tests__/
    middleware.test.ts           (new)
    validation.test.ts          (new)
    appointments.test.ts        (new)
    multi-tenant.test.ts        (new)
  evolution/__tests__/
    webhook.test.ts             (new)
    client.test.ts              (new)
  calendar/__tests__/
    operations.test.ts          (new)
  cache/__tests__/
    agent-cache.test.ts         (new)
  ws/__tests__/
    server.test.ts              (new)
```
