# ADR-001 — Autorización en la capa Express en lugar de RLS de Supabase

- **Estado:** Aceptado
- **Fecha:** 2026-06-23
- **Contexto TRD:** §4.1 (stack), RNF-02 (seguridad), §3 (roles por proyecto), CA-E01 (aislamiento del cliente)

## Contexto

El TRD v2 propone **Row Level Security (RLS) de Supabase** como "mecanismo central de
seguridad" (RNF-02): políticas por proyecto y rol aplicadas a nivel de fila en
PostgreSQL.

Durante el desarrollo, la implementación se desvió del stack original del TRD
(Next.js + cliente Supabase) hacia **React (Vite) + Express + Prisma ORM**, con la
identidad gestionada por el paquete compartido `@r4d-26/core` (Supabase Auth + JWT
propio de PIEIA) y una base de datos Postgres **compartida con otros productos de la
empresa** (wabee, etc.).

## Problema con RLS en esta arquitectura

RLS se aplica según el **rol de conexión** de Postgres y los claims del JWT que el
cliente Supabase adjunta a cada query. Pero en PIEIA:

1. **Prisma se conecta con una credencial privilegiada** (pooler en modo sesión,
   service role). Esa conexión **ignora (bypassa) las políticas RLS** por diseño. Las
   políticas RLS simplemente **no se evaluarían** sobre las consultas actuales.
2. Para que RLS sirviera, habría que **rearmar toda la capa de datos**: dejar de usar
   Prisma con conexión privilegiada y enrutar cada query por el cliente Supabase con el
   JWT del usuario final. Es un cambio arquitectónico mayor.
3. La base es **compartida entre productos**; activar RLS sobre el esquema afectaría a
   otros sistemas que hoy dependen del acceso por service role.

## Decisión

**La autorización por proyecto y rol vive en la capa Express**, no en RLS de Supabase.
Para que esa desviación sea segura, auditable y no dependa de la disciplina de cada
endpoint:

1. **La política es código puro y central**, en
   [`src/lib/policy.js`](../backend/src/lib/policy.js):
   - `decidirAccesoProyecto({ esAdmin, miembroRol, rolesPermitidos })` — la decisión que
     en otra arquitectura haría una política RLS.
   - `permiteAccesoInterno(rol)` — invariante CA-E01: el cliente nunca ve la superficie
     interna (entregables, revisiones, descargas, visor).
   - `permiteAccesoPortal(rol)` / `decidirSuperficie(...)` — superficie del Portal (MOD-E).
2. **El middleware `requireProjectRole`** y los endpoints internos (aps, entregables,
   revisiones, portal, auth/me) **delegan en esas funciones puras**; ya no repiten la
   regla a mano.
3. **Suite de tests automática** en
   [`src/lib/policy.test.js`](../backend/src/lib/policy.test.js) (`npm test`, runner
   nativo de Node, sin BD ni credenciales) que cubre la matriz completa de roles y, en
   particular, **CA-E01**: el cliente no accede a datos internos por ninguna vía.
4. **Defensa en profundidad a nivel BD que sí conservamos:** el candado de
   auto-aprobación de outputs de IA (RF-H06) está implementado como **trigger de
   Postgres** (`enforce_validacion_agente`), no solo en Express.

## Consecuencias

**Positivas**
- Encaja con Prisma + `@r4d-26/core` sin rehacer la capa de datos.
- La regla de seguridad es única, legible y **verificada por tests** en cada `npm test`.
- Cambiar una regla de acceso = cambiar una función pura + su test, no buscar `if`s
  dispersos por las rutas.

**Negativas / riesgos a vigilar**
- La seguridad depende de que **todo endpoint que toque datos de proyecto pase por
  `requireProjectRole` o por los helpers de `policy.js`**. Mitigación: revisión de PRs
  y, a futuro, tests de integración HTTP por ruta.
- Si algún día se exponen tablas directamente vía la API REST/Realtime de Supabase
  (sin pasar por Express), **esa vía sí necesitaría RLS**. Hoy no se usa.

## Reevaluación

Reconsiderar RLS real si: (a) se deja de usar la conexión por service role, (b) se
expone PostgREST/Realtime de Supabase al cliente, o (c) la base deja de ser compartida.
