// Política de autorización por proyecto (TRD §3, RNF-02, CA-E01).
//
// PIEIA implementa la autorización en la capa Express en lugar del Row Level
// Security de Supabase (ver docs/ADR-001-autorizacion-en-express.md). Para que esa
// decisión sea auditable y no dependa de la disciplina de cada endpoint, las reglas
// viven aquí como FUNCIONES PURAS y se cubren con tests (policy.test.js).
//
// Regla de oro: el rol se asigna POR PROYECTO (tabla miembro_proyecto), salvo el
// admin global. El cliente solo existe en la superficie del Portal (MOD-E) y NUNCA
// accede a la superficie interna de trabajo (RF-E05 / CA-E01).

export const ROL_CLIENTE = 'cliente';

// Roles válidos dentro de un proyecto (TRD §3).
export const ROLES_PROYECTO = ['coordinador', 'calculista', 'dibujante', 'cliente', 'lectura'];

// Roles considerados "staff" (equipo interno): cualquier rol de proyecto menos cliente.
export const ROLES_STAFF = ROLES_PROYECTO.filter((r) => r !== ROL_CLIENTE);

/**
 * Decisión central de acceso a un proyecto — lo que en otra arquitectura haría una
 * política RLS. Pura y exhaustivamente testeable.
 *
 * @param {object}   args
 * @param {boolean}  args.esAdmin          ¿es admin global del sistema?
 * @param {?string}  args.miembroRol       rol del usuario en el proyecto, o null si no es miembro
 * @param {string[]} args.rolesPermitidos  roles aceptados; vacío = acceso "staff" (cualquier interno)
 * @returns {{ permitido: boolean, motivo: string }}
 */
export function decidirAccesoProyecto({ esAdmin = false, miembroRol = null, rolesPermitidos = [] }) {
  if (esAdmin) return { permitido: true, motivo: 'admin_global' };
  if (!miembroRol) return { permitido: false, motivo: 'no_miembro' };

  if (rolesPermitidos.length > 0) {
    return rolesPermitidos.includes(miembroRol)
      ? { permitido: true, motivo: 'rol_permitido' }
      : { permitido: false, motivo: 'rol_no_permitido' };
  }

  // Sin roles explícitos = acceso a la superficie interna del equipo.
  // El cliente queda fuera por diseño (RF-E05 / CA-E01).
  if (miembroRol === ROL_CLIENTE) return { permitido: false, motivo: 'cliente_excluido_de_staff' };
  return { permitido: true, motivo: 'staff' };
}

/**
 * Invariante CA-E01: ¿puede este rol ver la superficie INTERNA de trabajo
 * (entregables, revisiones, descargas, visor)? El cliente nunca; debe ser miembro.
 */
export function permiteAccesoInterno(miembroRol) {
  return !!miembroRol && miembroRol !== ROL_CLIENTE;
}

/**
 * Acceso al Portal del cliente (MOD-E): EXCLUSIVO del rol cliente.
 * Un usuario interno (coordinador, calculista, etc.) no entra al Portal por su rol.
 */
export function permiteAccesoPortal(miembroRol) {
  return miembroRol === ROL_CLIENTE;
}

/**
 * Decide la superficie de un usuario a partir de TODOS sus roles de proyecto.
 * soloCliente=true ⇒ no tiene ningún rol interno y no es admin ⇒ ve solo el Portal.
 */
export function decidirSuperficie({ esAdmin = false, roles = [] }) {
  const esCliente = roles.includes(ROL_CLIENTE);
  const tieneRolStaff = roles.some((r) => r !== ROL_CLIENTE);
  return {
    esCliente,
    soloCliente: !esAdmin && esCliente && !tieneRolStaff,
  };
}
