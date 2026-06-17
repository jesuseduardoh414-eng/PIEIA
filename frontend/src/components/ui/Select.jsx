import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

// Select — primitivo del recetario (REGLAS §8). Misma anatomia que Input.
export const Select = forwardRef(function Select(
  { label, error, required, className, id, children, ...props },
  ref
) {
  const autoId = useId();
  const selId = id || autoId;

  return (
    <div className="grid gap-1.5">
      {label && (
        <label htmlFor={selId} className="text-label font-medium text-on-surface">
          {label}
          {required && <span className="text-error"> *</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-[var(--pieia-input-height)] w-full rounded-control border border-outline bg-surface px-3 text-body text-on-surface',
          'outline-none transition-colors duration-fast focus:border-primary disabled:opacity-[0.38]',
          error && 'border-error',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-label text-error">{error}</p>}
    </div>
  );
});
