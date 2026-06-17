import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Button — primitivo del recetario (REGLAS §7).
// Variantes por jerarquia de enfasis MD3. Consume SOLO tokens (nada hardcodeado).
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
    'text-label transition-all duration-fast ease-standard ' +
    'disabled:opacity-[0.38] disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        filled: 'bg-primary text-on-primary shadow-1 hover:-translate-y-[1px] hover:brightness-105 active:translate-y-0 active:brightness-95',
        tonal: 'bg-surface-variant text-on-surface hover:bg-surface hover:-translate-y-[1px]',
        outlined: 'border border-outline text-primary bg-transparent hover:bg-surface hover:border-primary/40',
        text: 'text-primary bg-transparent hover:bg-surface-variant',
        destructive: 'bg-error text-on-primary shadow-1 hover:-translate-y-[1px] hover:brightness-105 active:translate-y-0 active:brightness-95',
        icon: 'border border-transparent text-on-surface bg-transparent hover:border-outline hover:bg-surface',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'filled',
      size: 'md',
    },
  }
);

export const Button = forwardRef(function Button(
  { className, variant, size, loading = false, leadingIcon, trailingIcon, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

export { buttonVariants };
