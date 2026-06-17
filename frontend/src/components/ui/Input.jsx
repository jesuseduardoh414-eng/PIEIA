import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

// Input — primitivo del recetario (REGLAS §8). Anatomia estandar: label / control / error|helper.
// Consume tokens (--pieia-input-*). Estados: default, focus, error, disabled.
export const Input = forwardRef(function Input(
  { label, error, helper, required, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className="grid gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-label font-medium text-on-surface">
          {label}
          {required && <span className="text-error"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-[var(--pieia-input-height)] w-full rounded-control border bg-surface px-3 text-body text-on-surface',
          'border-outline outline-none transition-colors duration-fast placeholder:text-on-surface-variant',
          'focus:border-primary disabled:opacity-[0.38] disabled:pointer-events-none',
          error && 'border-error',
          className
        )}
        {...props}
      />
      {error ? (
        <p className="text-label text-error">{error}</p>
      ) : helper ? (
        <p className="text-label text-on-surface-variant">{helper}</p>
      ) : null}
    </div>
  );
});
