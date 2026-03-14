# Plan: Implementación de Test Suite para Talora Backend

## Contexto

El backend tiene ~9,300 LOC y ~0.5% de cobertura (1 archivo de test: `tool-executor.test.ts`). El test runner ya está configurado (`bun test` con env vars de prueba en `package.json`). No se necesitan dependencias nuevas.

## Convención de archivos

Tests colocados junto al código fuente en carpetas `__tests__/`:

```
apps/backend/src/
  agent/__tests__/
    tool-executor.test.ts       ← existe
    fuzzy-matching.test.ts      ← nuevo
    prompt-builder.test.ts      ← nuevo
    orchestration.test.ts       ← nuevo
  api/__tests__/
    middleware.test.ts           ← nuevo
    validation.test.ts           ← nuevo
  evolution/__tests__/
    webhook.test.ts              ← nuevo
    client.test.ts               ← nuevo
  calendar/__tests__/
    operations.test.ts           ← nuevo
  cache/__tests__/
    agent-cache.test.ts          ← nuevo
  ws/__tests__/
    server.test.ts               ← nuevo
  config.test.ts                 ← nuevo
```

---

## Fase 1 — Unit tests puros (sin infra, máximo ROI)

### Step 1: `apps/backend/src/api/__tests__/middleware.test.ts`

Mockear: `../auth/session` (decodeSession)

Tests (~12 cases):
- `authMiddleware`:
  - Token válido en Bearer header → setea `req.user`, llama `next()`
  - Token válido en query param `?token=xxx` → setea `req.user`, llama `next()`
  - Header tiene prioridad sobre query param
  - Token ausente → 401
  - Token expirado/malformado → 401 (decodeSession tira)
- `requireSuperadmin`:
  - `req.user.role === 'superadmin'` → `next()`
  - Otro role → 403
- `requireCompanyScope`:
  - superadmin con `?company_id=uuid` → `next()`
  - superadmin sin `?company_id` → 400
  - admin_empresa con companyId en JWT → `next()`
  - admin_empresa sin companyId en JWT → 400
- `getRequestCompanyId`:
  - superadmin → devuelve query param
  - admin_empresa → devuelve JWT companyId
- `getRequestProfessionalId`:
  - professional role → devuelve JWT professionalId
  - admin con query param → devuelve query param
  - sin nada → null

### Step 2: `apps/backend/src/api/__tests__/validation.test.ts`

Sin mocks (Zod schemas son puros).

Tests (~25 cases):
- `isValidUuid`: UUID válido → true, string random → false, vacío → false
- `parsePositiveInt`: "5" → 5, "0" → null, "-1" → null, "abc" → fallback, undefined → fallback
- `createAppointmentSchema`: campos requeridos presentes → pass, faltan campos → fail, strings vacíos → fail
- `reprogramAppointmentSchema`: startsAt válido → pass, sin startsAt → fail
- `createProfessionalSchema`: nombre + company → pass, user_email sin user_password → fail (mutual dependency)
- `updateProfessionalSchema`: partial update válido → pass
- `createServiceSchema`: nombre + duración → pass, aliases > 20 → fail, alias > 100 chars → fail
- `serviceImportPreviewSchema`: rows 1-1000 → pass, rows vacías → fail, row_number < 2 → fail
- `createClientSchema`: name + phone → pass, phone > 30 chars → fail
- `createCompanySchema`: company con nested professionals/services → pass
- `manualMessageSchema`: content 1-5000 chars → pass, vacío → fail, > 5000 → fail
- `testChatMessageSchema`: con session_id + message → pass, mode válido (live/simulate) → pass
- `validateBody` middleware: body válido → `next()`, body inválido → 400 con errores Zod

### Step 3: `apps/backend/src/agent/__tests__/fuzzy-matching.test.ts`

Extraer o importar directamente las funciones internas de `tool-executor.ts`. Si no están exportadas, exportarlas como named exports internos o testear a través de `executeTool` con mocks.

**Opción preferida:** Exportar las funciones puras (`normalizeLabel`, `tokenize`, `scoreServiceMatch`, `scoreProfessionalMatch`) desde tool-executor.ts para testing. Son funciones sin side effects.

Mockear: `../db/pool`, `../calendar/operations`, `../utils/url-validator`, `../utils/logger`

Tests (~20 cases):
- `normalizeLabel`:
  - "Corte De Pelo" → "corte de pelo"
  - "María José" → "maria jose" (acentos removidos)
  - "  spaces   here  " → "spaces here"
  - "abc!@#123" → "abc 123"
  - "" → ""
- `tokenize`:
  - "corte de pelo" → ["corte", "de", "pelo"]
  - "" → []
  - "single" → ["single"]
- `scoreServiceMatch`:
  - Exact name match → 400
  - Exact alias match → 400
  - All tokens bidirectional → 320
  - Prefix match → 260
  - Substring match → 260
  - All query tokens present, partial variant → 220+overlap
  - Partial overlap → 80+10*overlap
  - No match → 0
  - Below threshold (< 180) no es seleccionable
- `scoreProfessionalMatch`:
  - Exact match → 400
  - Partial match con tokens → score proporcional
  - Sin match → 0
- `resolveServiceSelection` (con DB mock):
  - serviceId UUID válido y existe → kind:'resolved'
  - serviceId UUID no existe → fallback a búsqueda por nombre
  - Búsqueda por nombre: 1 match claro → kind:'resolved'
  - Búsqueda por nombre: 2+ matches mismo score → kind:'ambiguous'
  - Búsqueda por nombre: ningún match ≥ 180 → kind:'missing'
  - Sin query y un solo servicio → kind:'resolved' (default)
  - Sin query y múltiples servicios → kind:'missing'
- `resolveProfessionalSelection` (con DB mock):
  - contextProfessionalId válido y existe → kind:'resolved'
  - Input professionalId UUID válido → kind:'resolved'
  - Input professionalId no-UUID → búsqueda por nombre
  - Sin profesionales activos → kind:'missing'
  - Sin query ni context → kind:'none'

### Step 4: `apps/backend/src/agent/__tests__/prompt-builder.test.ts`

Sin mocks (funciones puras).

Tests (~10 cases):
- `getSystemVariableValues`:
  - Con conversation context → userName, phoneNumber populados
  - Sin conversation → userName/phoneNumber vacíos
  - fechaHoraActual refleja timezone correcto
  - Aliases backward-compatible (nombreCliente = userName)
- `buildSystemPrompt`:
  - Security preamble siempre al inicio
  - Security suffix siempre al final
  - `{{variable}}` reemplazada por valor de custom variables
  - `{{fechaHoraActual}}` reemplazada por system variable
  - Variable desconocida → queda como `{{unknown}}`
  - Variable con `{{}}` en su valor → no doble-sustitución
  - Prompt vacío → solo preamble + suffix
- `getResolvedPreview`:
  - Devuelve prompt resuelto sin security wrappers (verificar)

### Step 5: `apps/backend/src/config.test.ts`

Tests (~5 cases):
- `parsePort`: "3001" → 3001, "abc" → 3001, "0" → 3001, "99999" → 3001, "8080" → 8080
- `requireEnv`: variable presente → valor, variable ausente → throws
- `optionalEnv`: variable presente → valor, variable ausente → fallback

---

## Fase 2 — Integraciones con mocks (webhook, Evolution client, prompt builder)

### Step 6: `apps/backend/src/evolution/__tests__/webhook.test.ts`

Mockear: `../db/pool`, `../config`, `../ws/server` (broadcast), `../agent/index` (handleIncomingMessage), `./client` (EvolutionClient), `../utils/logger`, `../utils/timeout`, `../conversations/reset`, `../conversations/archive`

Tests (~15 cases):
- **Autorización:**
  - webhookSecret configurado + header correcto → 200
  - webhookSecret configurado + header incorrecto → 401
  - webhookSecret no configurado + IP en allowlist → 200
  - Sin secret ni IP válida → 401
- **Idempotencia:**
  - Mismo messageId 2x → segundo call ignorado
  - Map > 10k entries → LRU cleanup ejecuta
  - Messages con TTL expirado → se reprocesan
- **MESSAGES_UPSERT:**
  - Mensaje entrante válido → crea/actualiza conversation, guarda message, llama handleIncomingMessage
  - fromMe=true → ignorado
  - status@broadcast → ignorado
  - Sin texto (media) → envía mensaje "no soportado", no llama agent
  - Conversación inactiva > 48h → auto-reset memoria
  - Reset command → llama resetConversationMemory, reacciona ✅
- **CONNECTION_UPDATE:**
  - state='open' → actualiza status='connected', borra QR
  - state='close' → status='disconnected'
- **QRCODE_UPDATED:**
  - QR data presente → guarda base64, status='qr_pending'
  - QR data ausente → log warning, no crash

### Step 7: `apps/backend/src/evolution/__tests__/client.test.ts`

Mockear: `global.fetch`, `../config`

Tests (~10 cases):
- **Requests exitosos:**
  - `sendText` formatea payload correcto (instanceName, to, text)
  - `fetchInstances` devuelve array parseado
  - `createInstance` pasa webhook config correctamente
  - `ping` no tira en respuesta 200
- **Retry logic:**
  - Network error → reintenta 1 vez (MAX_ATTEMPTS=2)
  - 4xx error → NO reintenta, tira EvolutionApiError inmediatamente
  - 5xx error → reintenta
  - Timeout (AbortError) → reintenta
- **Error handling:**
  - Respuesta no-JSON → tira error
  - `deleteInstance` 404 → no tira (idempotente) ← verificar si es así en client.ts vs operations.ts

### Step 8: `apps/backend/src/cache/__tests__/agent-cache.test.ts`

Mockear: `../db/pool`, `../agent/tool-config` (listEffectiveAgentTools)

Tests (~8 cases):
- Cache miss → ejecuta query DB, devuelve resultado
- Cache hit (dentro de TTL) → devuelve sin query DB
- Cache expirado (después de TTL) → re-fetch
- Requests concurrentes al mismo companyId → solo 1 fetch (dedup via pendingFetch)
- `invalidateAgentCache(companyId)` → próximo get hace fetch
- `invalidateAgentCache()` sin arg → limpia todo
- companyId null → devuelve null
- Agent no encontrado en DB → devuelve null, no cachea

---

## Fase 3 — Agent orchestration y Calendar (mocking pesado)

### Step 9: `apps/backend/src/agent/__tests__/orchestration.test.ts`

Mockear: `openai` (SDK), `../db/pool`, `../config`, `../evolution/client`, `./tool-executor`, `./prompt-builder`, `../calendar/operations`, `../cache/agent-cache`, `../utils/logger`, `../utils/timeout`, `./openai-runtime`

Tests (~12 cases):
- **Flujo básico:**
  - Mensaje sin tool calls → responde texto directo via Evolution
  - Mensaje con 1 tool call → ejecuta tool, envía follow-up response
  - Mensaje con 2+ tool calls paralelos (no-calendar) → Promise.all
  - Mensaje con calendar tool → ejecución secuencial
- **Límites:**
  - Max iterations (10) alcanzado → envía respuesta de corte
  - Agent timeout (120s) → envía fallback message
  - Tool timeout (60s) → tool devuelve error
- **Conversation locking:**
  - 2 mensajes simultáneos al mismo conversationId → se procesan en serie (no en paralelo)
  - Lock se libera correctamente después de error
- **Memory window:**
  - Mensajes > 48h → auto-reset, carga solo mensajes recientes
  - ≤ 20 mensajes cargados en contexto
- **Error handling:**
  - OpenAI API error → alerta guardada en DB, fallback message enviado
  - Tool execution error → trace con status='error', LLM recibe el error

### Step 10: `apps/backend/src/calendar/__tests__/operations.test.ts`

Mockear: `./client` (getCalendarClient → googleapis mock), `../config`, `../utils/logger`

Tests (~12 cases):
- **checkSlot:**
  - Slot libre (freebusy vacío) → available: true
  - Slot ocupado → available: false, suggestions con alternativas
  - Suggestions: busca ±3h, devuelve hasta 3 slots de 30min
  - Error de Google API → available: false, error message
- **bookSlot:**
  - Slot disponible → crea evento, devuelve eventId
  - Slot ocupado → success: false con suggestions
  - Booking concurrente mismo slot → lock serializa, segundo ve ocupado
  - Lock se libera en finally (incluso con error)
- **deleteEvent:**
  - Evento existe → success: true
  - Evento no existe (404) → success: true (idempotente)
  - Sin permiso (403) → success: false, error message
- **updateEvent:**
  - Evento existe → actualiza, success: true
  - Evento no encontrado → success: false
- **createEvent:**
  - Crea evento con summary, description, start/end correctos
  - CalendarId default → usa config.googleCalendarId

---

## Fase 4 — Route handlers + multi-tenant isolation

### Step 11: `apps/backend/src/api/__tests__/appointments.test.ts`

Approach: crear un helper `createTestApp()` que monta el router con middleware mockeado. Usar `fetch` nativo de Bun contra un servidor de test.

Mockear: `../db/pool`, `../../calendar/operations`, auth middleware (inject user context)

Tests (~12 cases):
- `POST /appointments` → crea appointment + Google Calendar event
- `POST /appointments` con body inválido → 400
- `PUT /appointments/:id/reprogram` → actualiza DB + Calendar
- `PUT /appointments/:id/cancel` → status cancelled + deleteEvent
- `GET /appointments` → lista filtrada por company_id
- `GET /appointments` para company A no devuelve datos de company B
- Professional user solo ve sus propios appointments
- Superadmin con `?company_id` ve solo esa empresa

### Step 12: Multi-tenant isolation test (transversal)

Tests (~8 cases):
- Seeder: crea 2 companies, 2 users, 2 professionals, datos para cada una
- `GET /clients?company_id=A` → solo clients de A
- `GET /conversations?company_id=A` → solo conversations de A
- `GET /professionals?company_id=A` → solo professionals de A
- `GET /services?company_id=A` → solo services de A
- admin_empresa de A no puede acceder a datos de B (sin company_id param)
- superadmin sin `?company_id` → error o vacío (no mezcla)
- Professional de company A no ve appointments de company B

---

## Fase 5 — WebSocket + extras

### Step 13: `apps/backend/src/ws/__tests__/server.test.ts`

Mockear: `ws`, `../db/pool`, `../auth/session`

Tests (~8 cases):
- **broadcast filtering:**
  - Evento con company_id=A → solo llega a sockets de company A
  - Evento sin company_id → llega a superadmin, no a admin_empresa
  - Professional socket → filtra por company_id Y professional_id
  - Superadmin → recibe todo
- **Connection management:**
  - JWT válido → conexión aceptada
  - JWT inválido → upgrade rechazado (401)
  - > 100 conexiones → rechaza (503)
  - Heartbeat: cliente que no responde pong → terminado

---

## Entregable por fase

| Fase | Archivos nuevos/modificados | Tests aprox | Output |
|------|----------------------------|-------------|--------|
| 0 | 3 source files modificados + 4 test helpers + CI config | 0 | Código testeable, infra de tests, CI |
| 1 | 5 archivos de test | ~72 cases | Fundación sólida, pure unit tests |
| 2 | 3 archivos de test | ~33 cases | WhatsApp + cache cubiertos |
| 3 | 2 archivos de test | ~24 cases | Core AI loop + Calendar cubiertos |
| 4 | 2 archivos de test + 1 helper | ~20 cases | Route handlers + tenant isolation |
| 5 | 1 archivo de test | ~8 cases | WebSocket cubierto |

**Total: 13 archivos de test, 4 test helpers, 3 refactors de testabilidad, CI workflow, ~157 test cases, 0 dependencias nuevas**

---

## Fase 0 — Preparación (antes de escribir tests)

### Step 0A: Refactors de testabilidad

Varios módulos tienen lógica crítica atrapada en funciones internas. Sin extraerlas, los tests son indirectos y frágiles. Cambios mínimos, sin alterar comportamiento:

**`agent/tool-executor.ts`** — Exportar funciones puras:
- `normalizeLabel`, `tokenize`, `scoreServiceMatch`, `scoreProfessionalMatch`
- `resolveServiceSelection`, `resolveProfessionalSelection`
- `resolveAppointmentByReference`, `upsertClient`

**`evolution/webhook.ts`** — Extraer lógica del router a funciones exportables:
- `isWebhookAuthorized(req)` → ya existe como función interna, solo agregar export
- `normalizePhone(raw)` → idem
- `handleMessagesUpsert(body)`, `handleConnectionUpdate(body)`, `handleQrCodeUpdate(body)` → idem

**`agent/index.ts`** — Exportar helpers puros:
- `safeJsonParse`, `getCachedAvailability`, `setCachedAvailability`, `buildAgentToolTrace`

**Criterio:** solo se exportan funciones que no cambian su firma ni su comportamiento. El refactor es puramente de visibilidad.

### Step 0B: Test helpers compartidos (`apps/backend/src/__test-utils__/`)

Crear helpers reutilizables para evitar duplicación masiva de mocks:

**`mock-pool.ts`:**
```typescript
// Re-exporta el patrón de setupQueryMock que ya existe en tool-executor.test.ts
export function createMockPool() { ... }
export function setupQueryMock(mockQuery, responses: Array<[string, unknown[]]>) { ... }
```

**`mock-logger.ts`:**
```typescript
export function createMockLogger() {
  return { error: mock(), warn: mock(), info: mock(), debug: mock() };
}
```

**`mock-request.ts`:**
```typescript
export function createMockReq(overrides?: Partial<Request>) { ... }
export function createMockRes() { ... } // con status().json() chainable
export function createMockNext() { ... }
```

**`factories.ts`:**
```typescript
export function makeCompany(overrides?) { ... }
export function makeProfessional(overrides?) { ... }
export function makeAppointment(overrides?) { ... }
export function makeService(overrides?) { ... }
export function makeConversation(overrides?) { ... }
export function makeMessage(overrides?) { ... }
```

Cada factory devuelve un objeto con defaults sensatos (UUIDs determinísticos, timestamps fijos) y permite override de cualquier campo.

### Step 0C: Coverage reporting y script de CI

**`package.json` (backend)** — Agregar script de coverage:
```json
{
  "scripts": {
    "test": "... bun test",
    "test:coverage": "... bun test --coverage"
  }
}
```

**`.github/workflows/test.yml`** (o agregar step al workflow existente):
```yaml
- name: Run tests
  run: cd apps/backend && bun test
```

Esto asegura que los tests se corren automáticamente en cada push/PR. Sin esto, los tests existen pero nadie los corre.

---

## Orden de ejecución

Fase 0 se ejecuta primero (es prerequisito de todo lo demás). Después, cada fase es secuencial. Dentro de cada fase, los steps son independientes y pueden ejecutarse en paralelo. Cada step es un commit independiente.
