import logoSrc from '@/assets/pieia-logo.png';
import { cn } from '@/lib/utils';

const SIZE = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

export function BrandMark({ size = 'md', className }) {
  return (
    <div className={cn('shrink-0', SIZE[size], className)}>
      <img src={logoSrc} alt="Logo PIEIA" className="h-full w-full object-contain" />
    </div>
  );
}

export function BrandLockup({ title = 'PIEIA', subtitle, size = 'md', className }) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <BrandMark size={size} />
      <div className="min-w-0">
        <p className="text-title font-semibold text-on-surface">{title}</p>
        {subtitle && <p className="text-label text-on-surface-variant">{subtitle}</p>}
      </div>
    </div>
  );
}
