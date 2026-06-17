// Mapa canonico estado de tarea -> etiqueta + color (REGLAS §13.1).
// UNICA fuente de verdad de los colores de estado; ningun modulo lo redefine.
export const ESTADO_META = {
  bloqueada: { label: 'Bloqueada', dot: 'var(--pieia-color-on-surface-variant)' },
  pendiente: { label: 'Pendiente', dot: 'var(--pieia-color-secondary)' },
  en_desarrollo: { label: 'En desarrollo', dot: 'var(--pieia-color-primary)' },
  en_espera_cliente: { label: 'Espera cliente', dot: 'var(--pieia-color-warning)' },
  en_revision: { label: 'En revision', dot: 'var(--pieia-color-primary)' },
  con_observaciones: { label: 'Con observaciones', dot: 'var(--pieia-color-warning)' },
  aprobada: { label: 'Aprobada', dot: 'var(--pieia-color-success)' },
  invalidada: { label: 'Invalidada', dot: 'var(--pieia-color-error)' },
};
