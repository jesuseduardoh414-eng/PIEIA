# ADR-002 — 2FA del core deshabilitado deliberadamente en PIEIA

- **Estado:** Aceptado
- **Fecha:** 2026-06-24
- **Contexto:** identidad vía `@r4d-26/core` (Supabase Auth + JWT propio), ver memoria del proyecto.

## Contexto

La identidad/login de PIEIA la maneja el paquete compartido `@r4d-26/core`. Ese core
**fuerza la configuración de 2FA (TOTP)** a los perfiles cuyo `globalRole` tiene "admin" en
el slug. PIEIA **no implementa 2FA** y gestiona quién es administrador con su propio campo
`Usuario.esAdmin` (no con el sistema de roles globales del core).

Además, `LoginUseCase` del core tiene un bug: si se reintenta el login con `globalRole=null`,
ejecuta `undefined.includes('admin')` y lanza un `TypeError` (falta optional chaining).

## Decisión

En `POST /api/auth/login`, cuando el core devuelve `requires2FASetup` o `requires2FA`, PIEIA
**omite el paso de 2FA** y firma el token de sesión directamente con `CORE_JWT_SECRET` (el
mismo secreto que usa el core internamente). Esto está **gateado por `PIEIA_2FA_BYPASS`**
(default activado; `=false` reactiva el comportamiento del core).

### Por qué NO es un hueco de autenticación
- `core.auth.login.execute()` **ya validó las credenciales contra Supabase Auth** antes de
  devolver `requires2FA`. Si la contraseña fuera incorrecta, lanza error y nunca se llega a
  este bloque. Aquí solo se salta el **segundo factor**, no la autenticación.
- El token se firma con el mismo secreto y formato que el core, y `requireAuth` lo valida con
  `core.auth.verifyToken.execute()`.

### Blindaje aplicado (tarea #8)
- Gateado por env var explícita `PIEIA_2FA_BYPASS` (decisión documentada, reversible).
- Firma del token envuelta en try/catch: si falla, responde 500 claro en vez de crashear.
- Auditoría: se registra un `logger.warn` cada vez que se omite el 2FA, con el email.
- La limpieza de `globalRoleId` en el perfil del core es best-effort (try/catch) y solo evita
  que el core vuelva a exigir 2FA en logins futuros.

## Consecuencias

**Positivas:** login funciona para PIEIA sin 2FA; es una decisión explícita y reversible; con
trazas de auditoría.

**Riesgos a vigilar:**
- Se escribe en el perfil del **core compartido** (`globalRoleId: null`). Si un usuario
  estuviera compartido como admin con otro producto R4D, esto le quitaría ese rol global.
  Para usuarios creados por PIEIA (sin globalRole) no aplica. Si se vuelve un problema,
  quitar la mutación: el bypass seguiría funcionando (solo se re-ejecutaría cada login).
- Si en el futuro PIEIA quiere 2FA real, hay que implementarlo y poner `PIEIA_2FA_BYPASS=false`.

## Mejor solución a futuro
Coordinar con el equipo del core para que los usuarios de PIEIA **no reciban un `globalRole`
"admin"** (que es lo que dispara el 2FA), eliminando la necesidad del bypass por completo.
