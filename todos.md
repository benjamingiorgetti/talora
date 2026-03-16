# Talora Backlog

## Done
- [x] `TOOL-1 · Wiring google_calendar_list como tool del agente`
  - Tool registrada en `core-tool-registry.ts`, case en `tool-executor.ts`, agregada a `CALENDAR_TOOLS`.
  - Usa `resolveOrFail` para resolver profesional/servicio/calendario.
  - 18/18 tests pasan. Typecheck limpio.

## Doing
_(vacío — nada en progreso activo)_

## To-do
- [ ] `MVP-4 · QA manual del MVP vendible`
  - Resultado esperado: existe una validación manual completa del MVP sobre un único vertical antes de abrir más casos.
  - Criterio de cierre: checklist manual ejecutado para `peluquería` o `dentista`, con registro claro de qué funciona, qué falla y qué queda inestable.

- [ ] `MVP-6 · Preparar empresa demo comercial`
  - Resultado esperado: queda una cuenta lista para mostrar producto en una demo comercial.
  - Criterio de cierre: empresa con agenda, conversaciones, clientes, servicios y profesionales cargados de forma consistente.

- [ ] `MVP-7 · Refinar setup/status de superadmin`
  - Resultado esperado: la consola de superadmin comunica con claridad qué le falta a cada empresa para quedar "lista para demo".
  - Criterio de cierre: estados operativos más claros y setup progresivo entendible sin mirar base de datos.

- [ ] `MVP-8 · Checklist reusable para próximos agentes`
  - Resultado esperado: cualquier próximo agente puede probar una cuenta nueva sin depender del contexto histórico de esta sesión.
  - Criterio de cierre: checklist operativo documentado en el repo con pasos, validaciones y orden de prueba.

- [ ] `MVP-9a · Validar consola admin/messages con trazas reales`
  - Resultado esperado: la vista `admin/messages` sirve para debug interno de Talora con conversaciones reales, mostrando prompt resuelto, contexto inyectado y tools ejecutadas por vuelta.
  - Qué falta cerrar: generar conversaciones nuevas después de la migración, validar que las trazas persisten y se leen bien en UI, revisar si la jerarquía visual de las islas alcanza para uso diario y decidir si `Alertas` sigue en la misma pantalla o se separa.

- [ ] `MVP-11 · QA end-to-end de archivado y reapertura automática`
  - Resultado esperado: la bandeja `Activos / Archivados` refleja bien reset, inactividad de 48h y reapertura por mensaje nuevo.
  - Criterio de cierre: caso probado para `activo -> /reset -> archivado`, `activo -> 48h sin interacción -> archivado`, y `archivado -> mensaje nuevo -> activo`, con historial completo visible y evento de sistema correcto.

- [ ] `ARCH-3 · Partir migrate.ts y dejar solo migraciones estructurales`
  - Resultado esperado: las migraciones dejan de mezclar schema, seeds y semántica operativa en un único archivo acumulativo.
  - Criterio de cierre: `migrate.ts` dividido o reemplazado por migraciones versionadas, sin backfills semánticos de prompt/tools core.

- [ ] `ARCH-6 · Definir estrategia para historial sin trazas`
  - Resultado esperado: las conversaciones viejas sin `agent_message_traces` tienen una política clara de compatibilidad.
  - Criterio de cierre: decisión explícita entre dejar estado degradado permanente, backfill parcial o reconstrucción limitada; UI y backend alineados con esa decisión.

- [ ] `QA-CAL · Testing end-to-end de tools de Google Calendar`
  - Resultado esperado: las tools del agente conversacional que interactúan con Google Calendar funcionan correctamente en todos los escenarios reales.
  - Casos a probar:
    - [ ] **Check & Book base**: ¿la tool se ejecuta bien? ¿se crea el evento en Google Calendar?
    - [ ] **Conflicto de horario**: ¿qué pasa si quiero reservar un turno a una hora que ya está ocupada?
    - [ ] **Eliminación de turno**: ¿qué pasa si quiero eliminar un turno existente?
    - [ ] **Reprogramación de turno**: ¿qué pasa si quiero reprogramar un turno a otro horario?
  - Criterio de cierre: los 4 escenarios probados manualmente con resultado documentado (funciona / falla / no implementado).


- [ ] `SEO-1 · Completar manifest.ts y JSON-LD structured data`
  - Qué ya existe: `sitemap.ts` y `robots.ts` funcionando.
  - Qué falta: `apps/frontend/src/app/manifest.ts` para PWA install y `apps/frontend/src/components/seo/json-ld.tsx` para rich results en search.

- [ ] `ARCH-7 · Migrar booking locks y EventEmitter a PostgreSQL para multi-instancia`
  - Resultado esperado: el backend puede correr en múltiples instancias sin race conditions en booking ni pérdida de eventos de attribution.
  - Contexto: hoy los booking locks (`bookSlot()` in-memory Map) y el EventEmitter de `events.ts` son in-process. Si se escala a 2+ instancias del backend, los locks no se comparten y los eventos de attribution se pierden. Migrar a PostgreSQL advisory locks + LISTEN/NOTIFY.
  - Prioridad: P3 (no urgente, single-instance es suficiente por ahora).

- [ ] `GROWTH-2 · Follow-up post-turno automatico`
  - Resultado esperado: Talora envía un "¿Cómo te fue con tu turno?" 24h después de cada appointment confirmado.
  - Contexto: reutiliza la infra de reactivation (sendText, conversación, template). Quick win para fidelización. Requiere un scheduler o check periódico de appointments que terminaron hace 24h.
  - Prioridad: P2 (feature post-Phase A de growth).

- [ ] `AGENT-1 · Inyectar turnos del cliente en contexto del agente`
  - Resultado esperado: el agente conversacional sabe qué turnos tiene el cliente antes de que el cliente lo diga.
  - Contexto: hoy el LLM no tiene visibilidad de los appointments existentes del cliente. Si pide cancelar, el bot no sabe qué appointment cancelar y pregunta servicio/profesional innecesariamente. Inyectar `recent_appointments` (filtrado por phone_number) en el system prompt del prompt-builder resolverría esto.
  - Criterio de cierre: el prompt incluye appointments activos del cliente, y el bot puede responder "tu turno del martes a las 14hs" sin que el cliente lo especifique.

- [ ] `BUFFER-1 · Startup recovery para buffers de mensajes perdidos`
  - Resultado esperado: si el backend se reinicia mientras hay un buffer pendiente, los mensajes sin respuesta se procesan automáticamente al arrancar.
  - Contexto: el message buffer vive en memoria (Map + setTimeout). Si el backend se reinicia dentro de la ventana de 10s, el timer se pierde y el usuario no recibe respuesta hasta que mande otro mensaje. Fix: al arrancar, buscar conversations con mensajes de usuario recientes (últimos 2 min) sin respuesta del bot y procesarlas.
  - Prioridad: P3 (edge case raro — restart + buffer activo, ventana de 10s).

- [ ] `AGENT-2 · Reprogram: extraer servicio del appointment existente`
  - Resultado esperado: `google_calendar_reprogram` puede funcionar sin resolución de servicio si el appointment ya existe.
  - Contexto: mismo patrón que el fix de cancel — si el appointment ya tiene service_id, se puede extraer duration y title sin pasar por resolveOrFail. Hoy funciona porque el LLM generalmente pasa hints de servicio, pero puede fallar igual que cancel.
  - Depende de: fix de cancel (patrón a seguir).
  - Criterio de cierre: reprogram con solo appointmentId + nueva fecha funciona sin pedir servicio.

## Reglas de uso
- `Done` solo se usa para trabajo validado con evidencia objetiva o prueba real.
- `Doing` debe tener máximo 4 cards activas al mismo tiempo.

## Supuestos del MVP
- El MVP es `turnos` + `crecimiento` (reactivación de clientes inactivos).
- Una empresa demo alcanza para validar el producto.
- No se abre multi-sucursal ni campañas masivas en esta etapa.
- El objetivo inmediato es demostrar ROI medible: "Talora te recuperó X clientes = $Y en turnos".
