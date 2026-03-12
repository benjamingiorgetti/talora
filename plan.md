# Talora MVP de Turnos por WhatsApp

## Resumen
Reorientar Talora desde un panel single-tenant técnico hacia una plataforma multiempresa de turnos por WhatsApp, con dos experiencias reales separadas:
- `Superadmin Talora`: crea y administra empresas, profesionales, servicios, reglas e integraciones.
- `Workspace cliente`: opera el negocio sin tecnicidad, con foco en `Dashboard`, `Calendario`, `WhatsApp`, `Turnos` y `Clientes`.

El MVP queda recortado a un `skate funcional`:
- Soporta `consultar disponibilidad`, `reservar`, `reprogramar al próximo horario disponible` y `cancelar`.
- Usa `Google Calendar` como fuente de verdad.
- Mantiene `Evolution API` como integración WhatsApp.
- Incluye `FAQs` vía prompt/reglas internas, sin exponer prompt/tools al cliente.
- Deja afuera `recordatorios`, `campañas`, `cobros automáticos`, `multi-sucursal` y configuración por parte del cliente.

## Cambios clave de producto y arquitectura
### Modelo de negocio y acceso
- Introducir `empresa` como unidad principal del sistema.
- Implementar auth real con roles y contexto:
  - `superadmin`
  - `admin_empresa`
- JWT con claims de `userId`, `role`, `companyId`.
- Soportar impersonación segura desde superadmin hacia workspace cliente.
- Un `workspace` por empresa, una sola sucursal por ahora.

### Modelo operativo del MVP
- Una empresa tiene:
  - un solo agente
  - uno o más profesionales
  - un calendario de Google por profesional
  - un catálogo de servicios con duración y precio informativo
  - una o más instancias de WhatsApp operadas vía Evolution
- Cada turno se crea como `confirmado automáticamente`.
- El bot consulta disponibilidad sobre Google Calendar y escribe allí los eventos.
- Talora refleja lo que exista en Google Calendar; Google es la fuente de verdad.
- El cliente puede intervenir manualmente desde Talora:
  - ver conversaciones
  - enviar mensajes manuales
  - pausar el bot por conversación
  - ver, crear, reprogramar y cancelar turnos

### Separación de vistas
- `Superadmin`:
  - empresas
  - overrides globales
  - plantillas por rubro
  - reglas/IA internas
  - mensajes/soporte
  - ajustes
- `Cliente`:
  - dashboard
  - calendario
  - WhatsApp
  - turnos
  - clientes
- Quitar del cliente todo lenguaje técnico:
  - no mostrar `prompt`, `tools`, `session test`, `tenant`, `studio`
- Mantener `Google Calendar` y `bot` como conceptos visibles sólo donde aporten claridad.

### Branding y UX
- Rediseñar con tono `premium operativo`: limpio, blanco/neutro, transversal, serio y no “AI toy”.
- No copiar branding de competidores; construir identidad propia de Talora.
- La UI cliente debe vender:
  - menos tiempo operativo
  - menos mensajes manuales
  - más turnos cerrados
  - control manual cuando hace falta
- La home cliente debe mostrar rápido:
  - turnos confirmados
  - resolución automática
  - tiempo ahorrado estimado
  - % de confirmación
- El módulo WhatsApp debe parecer una herramienta operativa real, no un placeholder.

## Cambios de implementación
### Backend
- Agregar entidades y relaciones para:
  - `companies`
  - `users`
  - `company_memberships` o equivalente
  - `professionals`
  - `services`
  - `google_calendar_connections` por profesional o equivalente
- Relacionar conversaciones, clientes, instancias y agente con `companyId`.
- Reemplazar auth de un solo admin por login multiusuario.
- Añadir guardas de acceso por rol y `companyId`.
- Crear flujos backend para:
  - alta de empresa
  - alta de admin de empresa
  - impersonación superadmin
  - CRUD de profesionales y servicios
  - consulta/escritura de turnos sobre Google Calendar
  - pausa por conversación
  - envío manual desde inbox
- Mantener `FAQs` dentro de reglas/prompt interno administrado sólo por superadmin.

### Frontend
- Separar shells/layouts de `superadmin` y `cliente`.
- Cliente:
  - `Dashboard`: métricas y estado general
  - `Calendario`: vista día/semana/mes con agenda por profesional
  - `WhatsApp`: inbox operativa con takeover humano y pausa por conversación
  - `Turnos`: vista lista de reservas/cancelaciones/reprogramaciones
  - `Clientes`: nombre, teléfono, próximo turno, notas, últimos 3 turnos
- Superadmin:
  - alta de empresa con set mínimo:
    - empresa
    - rubro
    - WhatsApp
    - calendar
    - profesionales
    - servicios
- Eliminar del cliente las tabs actuales de configuración técnica del agente.
- Reusar lo que ya existe de conversaciones, clientes, instancias y calendar sólo si sirve a la nueva IA; lo demás se replantea.

### Interfaces y tipos públicos
- Extender tipos compartidos para incluir al menos:
  - `Company`
  - `User`
  - `Role`
  - `Professional`
  - `Service`
  - `Appointment`
  - `ConversationPauseState`
  - métricas de dashboard por empresa
- Cambiar contratos de auth para devolver rol y contexto de empresa.
- Cambiar contratos de calendario/turnos para operar con:
  - profesional
  - servicio
  - duración
  - estado
  - origen Google Calendar

## Plan de pruebas
- Login superadmin y creación de empresa con datos mínimos.
- Creación de admin de empresa y acceso restringido a su workspace.
- Impersonación superadmin sin fuga de datos entre empresas.
- Alta de profesional y servicios; disponibilidad visible en calendario.
- Reserva desde bot sobre Google Calendar y visualización inmediata en Talora.
- Reprogramación al próximo slot disponible.
- Cancelación y reflejo consistente entre Talora y Google Calendar.
- Inbox WhatsApp:
  - ver conversación
  - enviar manualmente
  - pausar bot por conversación
  - retomar conversación
- Cliente:
  - no ve conceptos técnicos
  - no puede editar prompt/tools/reglas
- Métricas:
  - turnos confirmados
  - resolución automática
  - % confirmación
  - tiempo ahorrado estimado mockeado
- Verificación visual en desktop y mobile de ambas experiencias.

## Supuestos y defaults cerrados
- MVP enfocado sólo en `turnos`.
- `FAQs` sí entran, sólo vía reglas internas.
- `Recordatorios` quedan fuera del MVP.
- `Cobros` quedan fuera del MVP salvo precio informativo en reglas/servicios.
- `Campañas de recuperación` quedan fuera del MVP.
- `Una sucursal por empresa` por ahora.
- `Un agente por empresa`.
- `Google Calendar` como fuente de verdad.
- `Un calendario por profesional`.
- `Cliente` no configura nada sensible; todo eso lo hace superadmin.
- `Tiempo ahorrado` se presenta como estimación mockeada en MVP.
