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
  - Qué ya existe: `appointments`, create / reprogram / cancel desde UI, tools por defecto del agente y contexto de servicios/profesionales.
  - Qué falta validar: ejecución real del agente con Google Calendar y uso correcto de `professionalId` y `serviceId` en conversaciones reales.

- [ ] `BASE-5 · Inbox operativa`
  - Qué ya existe: listado de conversaciones, apertura de mensajes, pausa, resume y envío manual.
  - Qué falta validar: operación real contra Evolution con conversaciones reales, takeover humano y persistencia consistente.

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
