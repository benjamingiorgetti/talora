# Talora Backlog

## Done
- [x] `TOOL-1 · Wiring google_calendar_list como tool del agente`
  - Tool registrada en `core-tool-registry.ts`, case en `tool-executor.ts`, agregada a `CALENDAR_TOOLS`.
  - Usa `resolveOrFail` para resolver profesional/servicio/calendario.
  - 18/18 tests pasan. Typecheck limpio.

- [x] `AGENT-1 · Inyectar turnos del cliente en contexto del agente`
  - `loadRecentBookingsSummary()` en `apps/backend/src/agent/index.ts` carga los últimos 3 turnos confirmados por phone number.
  - Se inyecta como `recentBookingsSummary` / `client_appointments` en el system prompt via `prompt-builder.ts`.
  - El bot puede referenciar turnos existentes sin que el cliente los especifique.

- [x] `AGENT-2 · Reprogram: extraer servicio del appointment existente`
  - `tool-executor.ts` (lines 729-804): si no se provee servicio, usa `appointment.title` como fallback.
  - `service_id` se preserva del appointment existente en el update.
  - Reprogram con solo appointmentId + nueva fecha funciona sin pedir servicio.

- [x] `QA-CAL · Testing de tools de Google Calendar`
  - 4/4 escenarios cubiertos con tests unitarios:
    - Check & Book: crea evento, normaliza timezone, crea appointment record.
    - Conflicto de horario: retorna sugerencias cuando slot ocupado, serialización de bookings concurrentes.
    - Cancelación: funciona sin service selection, idempotente en 404, maneja profesionales desactivados.
    - Reprogramación: chequea disponibilidad, actualiza evento y appointment, normaliza fechas.
  - Error handling cubierto: OAuth expirado, red, permisos, profesional sin calendario.

## Doing
_(vacío — nada en progreso activo)_

## To-do
- [ ] `CRM-1 · KPI cards de analíticas por cliente`
  - Resultado esperado: la vista de detalle de cliente muestra 8 KPI cards con data real (último turno, ticket promedio, frecuencia, total turnos, revenue, mensajes enviados, tasa de respuesta, tasa de conversión).
  - Qué ya existe: `client_analytics` table con total_appointments/revenue/frequency/risk_score, `reactivation_messages` con tracking de sent/converted.
  - Qué falta: endpoint `GET /clients/:id/analytics` que combine datos + preferred_day + reactivation stats. Frontend KPI cards en detail view.
  - Prioridad: P1 — necesario para demo de ROI por cliente.

- [ ] `SEO-1 · Completar manifest.ts y JSON-LD structured data`
  - Qué ya existe: `sitemap.ts`, `robots.ts`, metadata con OpenGraph/Twitter cards en `layout.tsx`.
  - Qué falta: `apps/frontend/src/app/manifest.ts` para PWA install y `apps/frontend/src/components/seo/json-ld.tsx` para rich results en search.
  - Prioridad: P2 — poco trabajo, necesario para producción.

- [ ] `ARCH-7 · Migrar booking locks y EventEmitter a PostgreSQL para multi-instancia`
  - Resultado esperado: el backend puede correr en múltiples instancias sin race conditions en booking ni pérdida de eventos de attribution.
  - Estado actual: booking locks = `Map` in-memory con TODO comment en `operations.ts`. EventEmitter = Node.js in-process en `events.ts`.
  - Qué falta: PostgreSQL advisory locks para booking + LISTEN/NOTIFY para eventos.
  - Prioridad: P3 — no bloquea MVP en single-instance, bloquea escalar.

- [ ] `ARCH-3 · Partir migrate.ts y dejar solo migraciones estructurales`
  - Resultado esperado: las migraciones dejan de mezclar schema, seeds y semántica operativa en un único archivo acumulativo.
  - Estado actual: `migrate.ts` es un archivo monolítico de 875 líneas.
  - Criterio de cierre: migraciones versionadas, sin backfills semánticos de prompt/tools core.
  - Prioridad: P3 — deuda técnica, funciona pero escala mal.

- [ ] `BUFFER-1 · Startup recovery para buffers de mensajes perdidos`
  - Resultado esperado: si el backend se reinicia mientras hay un buffer pendiente, los mensajes sin respuesta se procesan automáticamente al arrancar.
  - Contexto: el message buffer vive en memoria (Map + setTimeout). Si el backend se reinicia dentro de la ventana de 10s, el timer se pierde y el usuario no recibe respuesta hasta que mande otro mensaje. Fix: al arrancar, buscar conversations con mensajes de usuario recientes (últimos 2 min) sin respuesta del bot y procesarlas.
  - Prioridad: P3 (edge case raro — restart + buffer activo, ventana de 10s).

- [ ] `UX-CAL-1 · Dim past day pills in week strip`
  - Resultado esperado: los pills de días pasados en el week strip se ven visualmente "completados" (más apagados o con checkmark), consistente con el tratamiento de turnos pasados.
  - Contexto: los appointment rows ya tienen tratamiento temporal (past/now/future), pero los day pills no reflejan esto. Completar la coherencia visual del calendario.
  - Prioridad: P3 (polish, no bloquea nada).

- [ ] `ARCH-6 · Definir estrategia para historial sin trazas`
  - Resultado esperado: las conversaciones viejas sin `agent_message_traces` tienen una política clara de compatibilidad.
  - Estado actual: UI en `messages-observability-panel.tsx` asume que trazas existen; backend no tiene fallback. Conversaciones viejas muestran vacío sin indicación.
  - Criterio de cierre: decisión explícita entre estado degradado permanente, backfill parcial o reconstrucción limitada.
  - Prioridad: P4 — deuda técnica, no bloquea MVP.

## Reglas de uso
- `Done` solo se usa para trabajo validado con evidencia objetiva o prueba real.
- `Doing` debe tener máximo 4 cards activas al mismo tiempo.

## Supuestos del MVP
- El MVP es `turnos` + `crecimiento` (reactivación de clientes inactivos).
- Una empresa demo alcanza para validar el producto.
- No se abre multi-sucursal ni campañas masivas en esta etapa.
- El objetivo inmediato es demostrar ROI medible: "Talora te recuperó X clientes = $Y en turnos".
