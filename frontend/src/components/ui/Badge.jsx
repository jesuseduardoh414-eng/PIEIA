import { ESTADO_META } from '@/lib/estadoTarea';

// Badge de estado de tarea (REGLAS §13.1): chip con punto de color segun el estado.
export function EstadoBadge({ estado }) {
  const meta = ESTADO_META[estado] || { label: estado, dot: 'var(--pieia-color-on-surface-variant)' };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-variant px-2.5 py-0.5 text-label font-medium text-on-surface">
      <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}
