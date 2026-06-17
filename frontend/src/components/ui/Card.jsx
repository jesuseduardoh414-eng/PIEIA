import { cn } from '@/lib/utils';

// Card — superficie del recetario (REGLAS §11). Elevacion y radio por token.
export function Card({ className, ...props }) {
  return (
    <div
      className={cn('bg-surface text-on-surface rounded-card shadow-1 border border-outline/50', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('p-6 pb-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-title font-semibold', className)} {...props} />;
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-6 pt-2', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('p-6 pt-2 flex items-center gap-2', className)} {...props} />;
}
