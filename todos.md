# Talora Backlog

## Doing
- [ ] `MVP-1 · Cerrar Google Calendar real por profesional`
  - Resultado esperado: Google Calendar funciona como fuente de verdad real por profesional, no solo como estructura cargada en base.
  - Avance actual: `GET /auth/google/calendars` ya lista calendarios reales accesibles y expone validación por profesional; el setup de profesionales ya rechaza `calendar_id` inválidos cuando Google está conectado.
  - Criterio de cierre: OAuth validado, mapeo por profesional validado y flujo `create / reprogram / cancel` probado contra calendarios reales con `calendar_connected` reflejando estado real.

- [ ] `MVP-2 · Cerrar WhatsApp real con Evolution`
  - Resultado esperado: la consola de superadmin permite crear instancia, conectar QR y operar WhatsApp de forma real.
  - Avance actual: la consola de superadmin ya muestra estado de instancia, QR visible y polling automático para detectar conexión sin refresco manual constante.
  - Criterio de cierre: creación de instancia validada, QR usable visible o estado equivalente visible, conexión real confirmada y pruebas reales de recepción, pausa, resume y envío manual.

- [ ] `MVP-3 · Validar flujo completo del bot sobre una empresa demo`
  - Resultado esperado: una empresa demo única puede reservar, reprogramar y cancelar turnos con consistencia entre Talora, Google Calendar y WhatsApp.
  - Criterio de cierre: demo creada con profesionales, servicios e instancia; el agente usa `professionalId` y `serviceId` correctamente; flujo end-to-end probado en escenario real.

- [ ] `MVP-4 · QA manual del MVP vendible`
  - Resultado esperado: existe una validación manual completa del MVP sobre un único vertical antes de abrir más casos.
  - Criterio de cierre: checklist manual ejecutado para `peluquería` o `dentista`, con registro claro de qué funciona, qué falla y qué queda inestable.

## To-do
- [ ] `MVP-5 · Limpiar restos tattoo-only`
  - Resultado esperado: el producto deja de verse atado a tatuajes en prompt interno, respuestas fallback y vistas técnicas.
  - Criterio de cierre: copy y fallbacks revisados, sin referencias innecesarias a tatuajes fuera de casos de demo o compat.

- [ ] `MVP-6 · Preparar empresa demo comercial`
  - Resultado esperado: queda una cuenta lista para mostrar producto en una demo comercial.
  - Criterio de cierre: empresa con agenda, conversaciones, clientes, servicios y profesionales cargados de forma consistente.

- [ ] `MVP-7 · Refinar setup/status de superadmin`
  - Resultado esperado: la consola de superadmin comunica con claridad qué le falta a cada empresa para quedar “lista para demo”.
  - Criterio de cierre: estados operativos más claros y setup progresivo entendible sin mirar base de datos.

- [ ] `MVP-8 · Checklist reusable para próximos agentes`
  - Resultado esperado: cualquier próximo agente puede probar una cuenta nueva sin depender del contexto histórico de esta sesión.
  - Criterio de cierre: checklist operativo documentado en el repo con pasos, validaciones y orden de prueba.

- [ ] `MVP-9 · Validar consola admin/messages con trazas reales`
  - Resultado esperado: la vista `admin/messages` sirve para debug interno de Talora con conversaciones reales, mostrando prompt resuelto, contexto inyectado y tools ejecutadas por vuelta.
  - Qué falta cerrar: generar conversaciones nuevas después de la migración, validar que las trazas persisten y se leen bien en UI, revisar si la jerarquía visual de las islas alcanza para uso diario y decidir si `Alertas` sigue en la misma pantalla o se separa.

- [ ] `MVP-9 · Ejecutar migración local del archivado de conversaciones`
  - Resultado esperado: la base local ya tiene `archived_at` y `archive_reason`, con índices y constraint aplicados.
  - Criterio de cierre: `bun run migrate` ejecutado sin errores y queries de conversaciones activas/archivadas funcionando sobre la DB real.

- [ ] `MVP-10 · Validar /reset real con Evolution`
  - Resultado esperado: `/reset` deja de mandar texto visible por WhatsApp y responde solo con reacción `✅`.
  - Criterio de cierre: prueba real sobre una conversación de WhatsApp donde el usuario no vea mensaje del bot, solo la reacción, y el chat pase a archivado.

- [ ] `MVP-11 · QA end-to-end de archivado y reapertura automática`
  - Resultado esperado: la bandeja `Activos / Archivados` refleja bien reset, inactividad de 48h y reapertura por mensaje nuevo.
  - Criterio de cierre: caso probado para `activo -> /reset -> archivado`, `activo -> 48h sin interacción -> archivado`, y `archivado -> mensaje nuevo -> activo`, con historial completo visible y evento de sistema correcto.

- [ ] `ARCH-1 · Normalizar un solo agent por empresa`
  - Resultado esperado: cada `company` tiene un único `agent` operativo y el backend deja de depender de `ORDER BY created_at ASC LIMIT 1` para elegirlo.
  - Criterio de cierre: datos duplicados limpiados, constraint o regla de creación aplicada y rutas/cache usando selección explícita del agent activo.

- [ ] `ARCH-2 · Sacar locks e idempotencia de memoria local`
  - Resultado esperado: `conversationLocks`, `processedMessages`, `knownInstances` y caches críticas no dependen de un solo proceso de Node/Bun.
  - Criterio de cierre: estrategia compatible con múltiples procesos definida e implementada, sin duplicación de mensajes ni carreras por conversación.

- [ ] `ARCH-3 · Partir migrate.ts y dejar solo migraciones estructurales`
  - Resultado esperado: las migraciones dejan de mezclar schema, seeds y semántica operativa en un único archivo acumulativo.
  - Criterio de cierre: `migrate.ts` dividido o reemplazado por migraciones versionadas, sin backfills semánticos de prompt/tools core.

- [ ] `ARCH-4 · Validar runtime core/custom del agente en flujo real`
  - Resultado esperado: el registro canónico de tools core funciona en conversación real y las tools custom siguen editables sin romper contratos internos.
  - Criterio de cierre: prueba manual de alta/edición/desactivación de tools core y custom sobre una empresa demo, con evidencia de que el runtime usa las core desde código.

- [ ] `ARCH-5 · Definir estrategia para historial sin trazas`
  - Resultado esperado: las conversaciones viejas sin `agent_message_traces` tienen una política clara de compatibilidad.
  - Criterio de cierre: decisión explícita entre dejar estado degradado permanente, backfill parcial o reconstrucción limitada; UI y backend alineados con esa decisión.

## Built / Unvalidated
- [ ] `BASE-1 · Multiempresa y auth`
  - Qué ya existe: `superadmin`, `admin_empresa`, JWT con `companyId` e impersonación con vuelta a Talora.
  - Qué falta validar: comportamiento real en escenarios multiempresa y ausencia de fugas de datos fuera de validación técnica/local.

- [ ] `BASE-2 · Workspace cliente`
  - Qué ya existe: `Dashboard`, `Calendario`, `WhatsApp`, `Turnos` y `Clientes` como superficies separadas.
  - Qué falta validar: uso real con datos productivos y consistencia operativa completa durante una sesión de trabajo real.

- [ ] `BASE-3 · Superadmin setup`
  - Qué ya existe: alta de empresa, alta de admin cliente, CRUD de profesionales, CRUD de servicios y creación de instancia.
  - Qué falta validar: que el setup completo deje una cuenta realmente operativa sin intervención manual extra fuera del flujo previsto.

- [ ] `BASE-4 · Turnos y agente`
  - Qué ya existe: `appointments`, create / reprogram / cancel desde UI, tools core del agente definidas en código y contexto de servicios/profesionales.
  - Qué falta validar: ejecución real del agente con Google Calendar y uso correcto de resolución de `professionalName` / `serviceName` en conversaciones reales.

- [ ] `BASE-5 · Inbox operativa`
  - Qué ya existe: listado de conversaciones, apertura de mensajes, pausa, resume y envío manual.
  - Qué falta validar: operación real contra Evolution con conversaciones reales, takeover humano y persistencia consistente.

- [ ] `BASE-6 · Observabilidad admin/messages`
  - Qué ya existe: persistencia de `agent_message_traces`, endpoint `/conversations/:id/traces` y UI admin con islas para prompt, contexto inyectado y tools ejecutadas.
  - Qué falta validar: datos reales post-migración, asociaciones correctas entre respuesta assistant y traza, manejo de errores/timeouts y comportamiento sobre historial viejo sin trazas.

- [ ] `BASE-6 · Reset silencioso + archivado`
  - Qué ya existe: modelo de conversación archivada, `/conversations?state=...`, reset como evento de sistema, reacción `✅` en webhook y tabs `Activos / Archivados` en la bandeja.
  - Qué falta validar: migración aplicada en base real, reacción soportada por Evolution real y consistencia de websocket/reapertura automática con conversaciones reales.

## Done
- [x] `OPS-1 · Base local validada`
  - Evidencia objetiva de validación: migraciones ejecutadas en base local, backend typecheck en verde, frontend lint en verde, frontend build en verde y frontend typecheck en verde.

## Reglas de uso
- `Done` solo se usa para trabajo validado con evidencia objetiva o prueba real.
- Si algo está implementado pero no probado end-to-end, va a `Built / Unvalidated`.
- `Doing` debe tener máximo 4 cards activas al mismo tiempo.
- El próximo agente debe arrancar por `MVP-1`, luego `MVP-2`, luego `MVP-3`, luego `MVP-4`.

## Supuestos del MVP
- El MVP sigue siendo solo `turnos`.
- Una empresa demo alcanza para validar el producto.
- No se abre multi-sucursal ni campañas en esta etapa.
- El objetivo inmediato es dejar un flujo real vendible, no sumar features nuevas.
