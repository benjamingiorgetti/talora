# Testing Agent Memory

## Quick Reference

- Test runner: `bun:test` (not Jest, not Vitest)
- Test utils: `apps/backend/src/__test-utils__/` — exporta `createMockReq`, `createMockRes`, `createMockNext`, factories, mock-pool, mock-logger
- Run a single test file: `cd apps/backend && bun test src/path/to/file.test.ts`
- Verbose output: `--reporter=dots` (bun solo soporta `junit` y `dots`)

## Key Patterns

### mock.module + top-level await import (CRITICAL)
Para mockear un módulo antes de importar el código bajo test en bun:test,
hay que usar `mock.module()` **antes** del `import`, y el import debe ser
**dinámico con `await`** a nivel de módulo (top-level await):

```typescript
mock.module('../../auth/session', () => ({
  decodeSession: mockDecodeSession,
}));

const { authMiddleware } = await import('../middleware');
```

No funciona con static imports (`import { } from ...`) porque los static
imports se elevan (hoisting) antes de que `mock.module` se ejecute.

### Typed mock functions
Siempre tipar el mock con la firma real, nunca usar `any`:

```typescript
const mockDecodeSession = mock((_token: string): JwtPayload => {
  throw new Error('not configured');
});
// En cada test: mockDecodeSession.mockImplementation(() => payload)
// Resetear en beforeEach: mockDecodeSession.mockReset()
```

### createMockRes — patrón chainable
`res.status(401).json({...})` funciona porque `status` retorna `res`.
El mock en `mock-request.ts` ya lo hace — `res.status` devuelve `res`.
Para verificar: `expect(res.status).toHaveBeenCalledWith(401)` y
`expect(res.json).toHaveBeenCalledWith({...})` por separado.

## Project-Specific

- `JwtPayload` está en `apps/backend/src/auth/session.ts`
- Roles disponibles: `superadmin`, `admin_empresa`, `professional`
- `TEST_IDS` en factories.ts tiene UUIDs fijos para todos los dominios
- Los tests de middleware NO requieren JWT real — `decodeSession` está mockeado

### Cache-buster para re-evaluar módulos con distintas env vars
Cuando un módulo ejecuta código al importarse (ej: `config.ts` llama `requireEnv`
en el top level), no se puede usar import estático. La solución:

```typescript
let counter = 0;
async function loadConfig(overrides: Record<string, string | undefined>) {
  // Set process.env before import, restore in finally
  const original = saveEnv(BASE_ENV, overrides);
  applyEnv(BASE_ENV, overrides);
  try {
    counter++;
    return await import(`../config?t=${counter}`); // cache-buster
  } finally {
    restoreEnv(original);
  }
}
```

- Cada especificador único es un módulo separado para Bun
- Siempre restaurar env vars en `finally` para evitar state leak entre tests
- BASE_ENV debe incluir TODAS las env vars requeridas por el módulo

## Project-Specific

- `config.ts` requiere: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `OPENAI_API_KEY`
- El script `test` en `package.json` inyecta las requeridas excepto `OPENAI_API_KEY`
  (hay que agregarla en el helper `loadConfig` o al script)

## scoreServiceMatch / scoreProfessionalMatch — Score Bands

| Band | Condition |
|------|-----------|
| 400 | Exact match (normalized name or alias === normalized query) |
| 320 | All query tokens ⊆ variant AND all variant tokens ⊆ query (same token set, different order) |
| 260 | variant.startsWith(query) OR variant includes ` ${query}` (word-boundary prefix/suffix) |
| 220+overlap | allQueryTokensPresent only (query tokens ⊆ variant, not vice versa) |
| 80+10*overlap | Any partial token overlap |
| 0 | No overlap |

Threshold for inclusion in match results: score >= 180.

## isUuid() in tool-executor

Uses strict RFC 4122 regex. IDs from `TEST_IDS` (e.g. `prof-aaaa-1111-2222-333333333333`) do NOT pass. For tests that hit UUID-gated paths (getProfessional, resolveServiceSelection with serviceId), use real UUIDs like `00000000-0000-4000-8000-000000000001`.

## Factory Types vs Shared Types

`makeService()` and `makeProfessional()` omit some fields required by `Service`/`Professional` (e.g., `description`, `updated_at`, `color_hex`). Build typed wrappers in test files that spread the factory and add missing fields, then cast with `as Service` / `as Professional`.

## Zod Schema Tests — Pure Unit Pattern

Para schemas Zod sin dependencias externas no se necesita ningún mock.
Patrón limpio: `schema.safeParse(input)` + `expect(result.success).toBe(true/false)`.
Para verificar defaults: hacer safeParse válido y leer `result.data.field`.

Casos obligatorios por schema:
1. Happy path (todos los campos requeridos)
2. Defaults aplicados (campos opcionales con default)
3. Campo requerido ausente → failure
4. Límites de longitud exactos (max, max+1)
5. Enum inválido → failure
6. `.refine()` cross-field → probar combinación válida e inválida

`validateBody` middleware — testear con `createMockReq/Res/Next`:
- body válido → `next()` llamado, `req.body` mutado con datos parseados
- body inválido → `res.status(400)` + `res.json` con `{ error: string }`, `next` NO llamado

## Freezing `Date` for deterministic time-based tests

Patch `globalThis.Date` with a subclass **before** doing `await import()` of the module under test:

```typescript
const FIXED_ISO = '2026-03-14T15:30:00.000Z';
const OriginalDate = globalThis.Date;
class FrozenDate extends OriginalDate {
  constructor(...args: ConstructorParameters<typeof OriginalDate>) {
    if (args.length === 0) { super(FIXED_ISO); } else { super(...args as any); }
  }
  static now() { return new OriginalDate(FIXED_ISO).getTime(); }
}
globalThis.Date = FrozenDate as unknown as typeof Date;
const { fn } = await import('../module');
```

## SECURITY_PREAMBLE contains `{{variables}}`

`buildSystemPrompt` resolves `{{recentBookingsSummary}}` inside `SECURITY_PREAMBLE` itself.
Therefore `result.startsWith(SECURITY_PREAMBLE)` will be **false**.
Assert on the invariant prefix: `SECURITY_PREAMBLE.split('{{')[0]`.

## buildSystemPrompt — variable substitution rules

- Only `customVariables` with `category === 'custom'` are substituted; `category === 'system'` entries are ignored.
- Single-pass substitution: a variable value containing `{{...}}` is NOT expanded a second time.
- `variableOverrides` win over system vars and custom vars (applied last).

## Stateful Module Cache Tests (agent-cache pattern)

Para módulos que mantienen estado en Maps a nivel de módulo (ej: `cachedConfig`, `cacheExpiry`, `pendingFetch`):

1. Exponer y llamar la función de invalidación total (`invalidateAgentCache()`) en `beforeEach`.
2. Llamar `mockQuery.mockReset()` en `beforeEach` para limpiar call counts entre tests.
3. Para verificar cache hit: capturar `mockQuery.mock.calls.length` tras el primer fetch, luego llamar de nuevo y verificar que el count no cambió.
4. Para verificar dedup de concurrent requests: usar `Promise.all([getX(id), getX(id)])` y contar llamadas SQL con `filter` por fragmento de SQL.
5. Para mutation testing: romper la condición `now < expiry` → los tests de cache hit y de aislamiento de companyId deben fallar.

`makeQueryResult<T>` helper útil para crear `QueryResult<T>` tipados:
```typescript
function makeQueryResult<T>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
```

## Existing Test Files

- `apps/backend/src/agent/__tests__/tool-executor.test.ts` — guards, appointment ownership
- `apps/backend/src/agent/__tests__/fuzzy-matching.test.ts` — normalizeLabel, tokenize, scoreServiceMatch, scoreProfessionalMatch, resolveServiceSelection, resolveProfessionalSelection (35 tests)
- `apps/backend/src/api/__tests__/validation.test.ts` — isValidUuid, parsePositiveInt, todos los schemas Zod, validateBody middleware (76 tests)
- `apps/backend/src/agent/__tests__/prompt-builder.test.ts` — getSystemVariableValues, buildSystemPrompt, getResolvedPreview (19 tests)
- `apps/backend/src/cache/__tests__/agent-cache.test.ts` — cache miss/hit/TTL, concurrent dedup, invalidation, null/notfound cases (10 tests)

## EvolutionClient Tests — Patterns

- `src/evolution/__tests__/client.test.ts` — 15 tests, sendText/fetchInstances/createInstance/ping/getInstanceStatus, retry logic, EvolutionApiError properties, URL/header construction
- `config` mock: `mock.module('../../config', () => ({ config: { evolutionApiUrl, evolutionApiKey } }))` before `await import('../client')`
- `global.fetch` mock: assign `globalThis.fetch = mock(async (...) => makeResponse(status, body))` per test
- Retry delays bypassed: `globalThis.setTimeout = mock((fn) => { fn(); return 0; })` in `beforeAll`
- `makeResponse(status, body)` helper builds minimal Response-compatible object (`.ok`, `.status`, `.text()`, `.json()`)
- `apikey` header is lowercase — `headers['apikey']`, not `Authorization`

## mock.module path resolution — rule confirmed

`mock.module` paths are relative to the **test file**, not the source file under test.
To mock `./client` imported by `src/calendar/operations.ts`, from a test at
`src/calendar/__tests__/operations.test.ts` you write `mock.module('../client', ...)`.

Bun resolves both paths to the same absolute path and intercepts the import — no matter
which file issues the import.

## Calendar Operations Tests

- `src/calendar/__tests__/operations.test.ts` — 16 tests
- Mocks: `../client` (getCalendarClient), `../../config`, `../../utils/logger`
- `bookingLocks` Map is module-level state but self-cleans after each call completes; no
  explicit reset needed in `beforeEach` — `mockReset()` on the mock functions is sufficient.
- `checkSlot` makes TWO `freebusy.query` calls when the slot is busy (1st for the slot,
  2nd for the suggestion search window); mock both with `.mockImplementationOnce`.
- `deleteEvent` 404 idempotency: throw `Object.assign(new Error('Not Found'), { code: 404 })`.

## Webhook Handler Tests (evolution/webhook.ts)

- `src/evolution/__tests__/webhook.test.ts` — 22 tests
- Mocks: `../../db/pool`, `../../config`, `../../ws/server`, `../../agent/index`,
  `../client` (EvolutionClient class), `../../utils/logger`, `../../utils/timeout`,
  `../../conversations/reset`, `../../conversations/archive`
- `EvolutionClient` is instantiated at module load via `new EvolutionClient()`.
  Mock it as a class with instance methods: `mock.module('../client', () => ({ EvolutionClient: class { sendText = ...; } }))`.
- `processedMessages` Set is module-level — persists across all tests in file.
  Use unique `key.id` per test to avoid idempotency false-negatives.
- `pool.query` call shape: `args[0]` = SQL string, `args[1]` = params array.
  Assert params as: `expect(call[1]).toEqual([...])` NOT `.toBe(scalar)`.
- Config mock is a plain object — safe to mutate within a test and restore after.
  `(config as Record<string, unknown>).webhookSecret = 'val'` then restore.
- `withTimeout` mock: `mock(<T>(p: Promise<T>) => p)` — just passes through the promise.

## Links to Detail Files

- `patterns.md` — patrones de mocking y test architecture (TODO: expandir)
