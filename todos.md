# Talora Backlog

## Doing
_(vacío — nada en progreso activo)_

## To-do
- [ ] `MVP-4 · QA manual del MVP vendible`
  - Resultado esperado: existe una validación manual completa del MVP sobre un único vertical antes de abrir más casos.
  - Criterio de cierre: checklist manual ejecutado para `peluquería` o `dentista`, con registro claro de qué funciona, qué falla y qué queda inestable.

- [ ] `MVP-5 · Limpiar restos tattoo-only`
  - Resultado esperado: el producto deja de verse atado a tatuajes en prompt interno, respuestas fallback y vistas técnicas.
  - Criterio de cierre: copy y fallbacks revisados, sin referencias innecesarias a tatuajes fuera de casos de demo o compat.

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

- [ ] `MVP-9b · Ejecutar migración local del archivado de conversaciones`
  - Resultado esperado: la base local ya tiene `archived_at` y `archive_reason`, con índices y constraint aplicados.
  - Criterio de cierre: `bun run migrate` ejecutado sin errores y queries de conversaciones activas/archivadas funcionando sobre la DB real.

- [ ] `MVP-10 · Validar /reset real con Evolution`
  - Resultado esperado: `/reset` deja de mandar texto visible por WhatsApp y responde solo con reacción `✅`.
  - Criterio de cierre: prueba real sobre una conversación de WhatsApp donde el usuario no vea mensaje del bot, solo la reacción, y el chat pase a archivado.

- [ ] `MVP-11 · QA end-to-end de archivado y reapertura automática`
  - Resultado esperado: la bandeja `Activos / Archivados` refleja bien reset, inactividad de 48h y reapertura por mensaje nuevo.
  - Criterio de cierre: caso probado para `activo -> /reset -> archivado`, `activo -> 48h sin interacción -> archivado`, y `archivado -> mensaje nuevo -> activo`, con historial completo visible y evento de sistema correcto.

- [ ] `ARCH-3 · Partir migrate.ts y dejar solo migraciones estructurales`
  - Resultado esperado: las migraciones dejan de mezclar schema, seeds y semántica operativa en un único archivo acumulativo.
  - Criterio de cierre: `migrate.ts` dividido o reemplazado por migraciones versionadas, sin backfills semánticos de prompt/tools core.

- [ ] `ARCH-4 · Validar runtime core/custom del agente en flujo real`
  - Resultado esperado: el registro canónico de tools core funciona en conversación real y las tools custom siguen editables sin romper contratos internos.
  - Criterio de cierre: prueba manual de alta/edición/desactivación de tools core y custom sobre una empresa demo, con evidencia de que el runtime usa las core desde código.

- [ ] `UX-1 · QA calendar toolbar en mobile con 4+ profesionales`
  - Resultado esperado: validar que el toolbar compacto (week nav + filter pills) se comporta bien en pantallas chicas cuando hay muchos profesionales.
  - Criterio de cierre: probado en viewport 375px con 4+ pills, sin overflow horizontal ni superposición con la navegación de semana.

- [ ] `ARCH-6 · Definir estrategia para historial sin trazas`
  - Resultado esperado: las conversaciones viejas sin `agent_message_traces` tienen una política clara de compatibilidad.
  - Criterio de cierre: decisión explícita entre dejar estado degradado permanente, backfill parcial o reconstrucción limitada; UI y backend alineados con esa decisión.

## Built / Unvalidated
- [ ] `MVP-1 · Google Calendar real por profesional`
  - Qué ya existe: OAuth flow completo, `google_calendar_connections` por profesional, CRUD de eventos, checkSlot/bookSlot con lock por slot, endpoint `/auth/google/calendars` con validación real.
  - Qué falta validar: prueba E2E con cuenta Google real, multi-instance locking (hoy es in-memory), timezone handling en disponibilidad.

- [ ] `MVP-2 · WhatsApp real con Evolution`
  - Qué ya existe: Evolution client con retry, webhook handler con idempotencia y TTL, QR flow, instance status management, phone normalization.
  - Qué falta validar: prueba real con Evolution API y dispositivo físico, QR polling en frontend, pause/resume sobre conversaciones reales.

- [ ] `MVP-3 · Flujo completo del bot sobre empresa demo`
  - Qué ya existe: agent orchestration con OpenAI, tool executor con resolución fuzzy de profesional/servicio, context scoping por profesional, conversation locking.
  - Qué falta validar: flujo E2E real (WhatsApp → bot → Calendar → respuesta), empresa demo con datos realistas.

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

- [ ] `BASE-6a · Observabilidad admin/messages`
  - Qué ya existe: persistencia de `agent_message_traces`, endpoint `/conversations/:id/traces` y UI admin con islas para prompt, contexto inyectado y tools ejecutadas.
  - Qué falta validar: datos reales post-migración, asociaciones correctas entre respuesta assistant y traza, manejo de errores/timeouts y comportamiento sobre historial viejo sin trazas.

- [ ] `BASE-6b · Reset silencioso + archivado`
  - Qué ya existe: modelo de conversación archivada, `/conversations?state=...`, reset como evento de sistema, reacción `✅` en webhook y tabs `Activos / Archivados` en la bandeja.
  - Qué falta validar: migración aplicada en base real, reacción soportada por Evolution real y consistencia de websocket/reapertura automática con conversaciones reales.

- [ ] `ARCH-2 · Locks e idempotencia`
  - Qué ya existe: conversationLocks (Map), processedMessages (Map con TTL 10min, cap 10k), per-slot calendar locking.
  - Qué falta validar: comportamiento correcto bajo carga real y multi-proceso (hoy todo es in-memory, single-instance).

## Done
- [x] `OPS-1 · Base local validada`
  - Evidencia: migraciones ejecutadas, backend typecheck verde, frontend lint verde, frontend build verde.

- [x] `OPS-2 · Test suite completa`
  - Evidencia: 14 test files, ~157 test cases, CI configurado en `.github/workflows/test.yml`, todos los tests pasan.

- [x] `ARCH-1 · Normalizar un solo agent por empresa`
  - Evidencia: migración limpia duplicados + UNIQUE INDEX en `agents(company_id)`, query simplificada sin ORDER BY LIMIT 1.

- [x] `ARCH-5 · Convention: declare functions before useEffect`
  - Evidencia: convención documentada en CLAUDE.md, auditoría de 21 componentes sin violaciones.

- [x] `ARCH-OWNERSHIP · Ownership real por profesional`
  - Evidencia: webhook hardened, agent scoped, tool executor con ownership checks, conversation APIs filtradas por professional_id. Implementado según plan-arquitectura.md.

- [ ] `SEO-1 · Agregar sitemap.ts, manifest.ts y JSON-LD structured data`
  - Resultado esperado: sitemap.xml lista URLs públicas para Google, manifest.json habilita PWA install, JSON-LD muestra rich results en search.
  - Contexto: cortado del PR de favicon/SEO por scope. Cada archivo es 10-15 líneas. Más valioso cuando existan más páginas públicas (landing, pricing).
  - Archivos: `apps/frontend/src/app/sitemap.ts`, `apps/frontend/src/app/manifest.ts`, `apps/frontend/src/components/seo/json-ld.tsx` + importar en layout.tsx.

- [ ] `SEO-1 · Agregar sitemap.ts, manifest.ts y JSON-LD structured data`
  - Resultado esperado: sitemap.xml lista URLs públicas para Google, manifest.json habilita PWA install, JSON-LD muestra rich results en search.
  - Contexto: cortado del PR de favicon/SEO por scope. Cada archivo es 10-15 líneas. Más valioso cuando existan más páginas públicas (landing, pricing).
  - Archivos: `apps/frontend/src/app/sitemap.ts`, `apps/frontend/src/app/manifest.ts`, `apps/frontend/src/components/seo/json-ld.tsx` + importar en layout.tsx.

## Reglas de uso
- `Done` solo se usa para trabajo validado con evidencia objetiva o prueba real.
- Si algo está implementado pero no probado end-to-end, va a `Built / Unvalidated`.
- `Doing` debe tener máximo 4 cards activas al mismo tiempo.
- El próximo agente debe arrancar por `MVP-4`.

## Supuestos del MVP
- El MVP sigue siendo solo `turnos`.
- Una empresa demo alcanza para validar el producto.
- No se abre multi-sucursal ni campañas en esta etapa.
- El objetivo inmediato es dejar un flujo real vendible, no sumar features nuevas.
