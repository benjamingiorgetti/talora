# Plan de Cierre: Ownership Real por Profesional en WhatsApp, Conversaciones e IA

## Resumen

La parte ya resuelta cubre `login profesional`, `clientes/turnos` con scope, `Google Calendar propio` y `agenda personal`. Lo que sigue dudoso, y debe revisar otro agente, es el núcleo operativo de WhatsApp e IA: hoy la UI ya puede mostrar “lo mío”, pero el ingreso de mensajes y parte del razonamiento del bot todavía nacen con lógica de empresa.

Objetivo de este plan: dejar el sistema decision-complete para que `cada profesional tenga sus clientes, sus conversaciones, su contexto y su calendario`, sin mezcla silenciosa a nivel bot.

## Cambios clave

### 1. Endurecer ownership en el ingreso de WhatsApp

- Mantener `whatsapp_instances` por empresa; no introducir instancia por profesional en esta fase.
- Definir la regla operativa central:
  - Si existe `client` para `company_id + phone_number`, usar su `professional_id`.
  - Si no existe `client` o no tiene `professional_id`, la conversación entra como `professional_id = null` y queda en cola/revisión de admin.
  - No asignar profesional “por default” ni por primer profesional activo.
- En el webhook de Evolution:
  - seguir resolviendo por empresa + teléfono para encontrar cliente existente
  - persistir `conversations.professional_id` desde ese cliente
  - no sobreescribir una conversación ya asignada con otro profesional salvo flujo explícito de reasignación
- Publicar eventos websocket con `professional_id` consistente en todos los payloads de conversación/mensaje relevantes.

### 2. Hacer que el bot piense en scope profesional

- En `apps/backend/src/agent/index.ts`, dejar de resolver contexto solo por `company_id + phone_number`.
- Regla nueva para todo el pipeline del agente:
  - cargar la conversación
  - derivar `conversation.professional_id`
  - si hay `professional_id`, usarlo para acotar cliente, servicios, profesionales y calendario
  - si no hay `professional_id`, responder con fallback de triage o escalar a admin; no agendar ni prometer disponibilidad
- Variables del prompt:
  - `contextoCliente` debe salir del cliente asignado a ese profesional
  - `availableServices` debe listar solo servicios globales o del profesional dueño
  - `availableProfessionals` no debe exponer toda la empresa en sesión/conversación profesional; por default mostrar solo el profesional dueño
  - `horariosDisponibles` debe usar el calendario del profesional dueño, nunca “el primero de la empresa”
- El agente no debe contestar con contexto cruzado si el cliente pertenece a otro profesional.

### 3. Alinear tool executor y agenda automática

- En `apps/backend/src/agent/tool-executor.ts`:
  - toda operación de upsert de cliente debe requerir `professionalId` cuando proviene de una conversación asignada
  - si el teléfono pertenece a otro profesional, devolver error explícito y no mutar
  - si la conversación no tiene `professional_id`, bloquear booking/reprogramación/cancelación automática
- Regla de calendario:
  - toda operación Google debe resolverse con `professional_id` de la conversación/turno
  - no usar fallback global de calendario salvo compat legacy explícita y temporal
- Regla de seguridad:
  - si falta conexión Google del profesional, el bot puede informar setup incompleto pero no reservar en otro calendario.

### 4. Endurecer APIs de conversaciones para profesionales

- Consolidar `apps/backend/src/api/conversations.ts` como API profesional-safe:
  - listados, mensajes, pause/resume y manual send ya deben respetar `professional_id`
  - revisar y completar cualquier endpoint/evento faltante bajo la misma regla
- Comportamiento esperado:
  - `admin_empresa` ve todas las conversaciones de su empresa
  - `professional` ve solo conversaciones con su `professional_id`
  - conversaciones `professional_id = null` quedan visibles solo para admin
- No agregar ownership a `messages`; siguen heredando scope desde `conversation_id`.

### 5. Compatibilidad y migración de datos

- No cambiar todavía la unicidad de `whatsapp_instances`.
- Mantener por ahora el lookup de cliente por `company_id + phone_number`, pero tratarlo como resolución inicial, no como permiso suficiente.
- Preparar manejo de legacy:
  - clientes sin `professional_id`
  - conversaciones sin `professional_id`
  - turnos históricos ligados a clientes legacy
- Default elegido:
  - los registros legacy sin dueño no se muestran a profesionales
  - quedan visibles a admin para asignación manual
- Si existe conflicto de teléfono asignado a otro profesional:
  - no duplicar silenciosamente
  - no transferir automáticamente
  - fallar con error claro y requerir reasignación manual/admin

## Cambios de interfaces y contratos

- `Conversation` ya incluye `professional_id`; tomarlo como obligatorio para cualquier flujo profesional nuevo.
- El pipeline interno del agente debe aceptar y propagar `professional_id` como parte del contexto operativo.
- Respuestas de error esperadas:
  - cliente pertenece a otro profesional
  - conversación sin profesional asignado
  - profesional sin Google Calendar conectado
- No cambiar el contrato público de login/auth en esta fase.
- No agregar un nuevo rol; usar `professional`, `admin_empresa`, `superadmin` existentes.

## Casos de prueba

- WhatsApp con cliente ya asignado:
  - entra mensaje
  - la conversación queda/permanece asignada al profesional correcto
  - el bot responde usando solo su contexto y su agenda
- WhatsApp con cliente sin asignar:
  - entra mensaje
  - conversación queda `professional_id = null`
  - no se agenda automáticamente
  - solo admin la ve
- WhatsApp con cliente de otro profesional:
  - el bot no toma contexto cruzado
  - booking automático falla con error claro
- Profesional autenticado:
  - lista solo sus conversaciones y mensajes
  - no puede pausar/reanudar/enviar manualmente sobre conversación ajena
- Admin autenticado:
  - ve conversaciones de toda la empresa, incluidas no asignadas
- Agenda bot:
  - `horariosDisponibles`, booking, cancel y reprogramación usan el calendario del profesional dueño
  - si falta conexión Google, no hay fallback a otro calendario
- Legacy:
  - clientes y conversaciones sin `professional_id` no explotan el flujo
  - quedan fuera del alcance del profesional y visibles al admin

## Supuestos y defaults

- Un cliente pertenece a un único profesional a la vez.
- Un número de WhatsApp puede existir una sola vez por empresa en esta fase; no se implementa multiplexado por profesional.
- La reasignación de clientes/conversaciones sigue siendo una acción explícita de admin, no automática.
- No se implementa todavía “instancia de WhatsApp por profesional”.
- La prioridad es consistencia operativa y evitar mezcla de contexto, aunque eso deje algunos casos legacy en revisión manual.
