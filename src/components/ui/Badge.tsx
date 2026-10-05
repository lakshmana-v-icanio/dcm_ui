import { cn } from '../../lib/cn';

type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'secondary';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  default: 'bg-slate-100 text-slate-600',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  error: 'bg-error-100 text-error-700',
  secondary: 'bg-slate-200 text-slate-700',
};

export const Badge = ({ label, tone = 'default', size = 'sm', className }: BadgeProps) => (
  <span className={cn(
    'inline-flex items-center font-medium rounded-full shrink-0',
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
    tones[tone],
    className
  )}>
    {label}
  </span>
);

export default Badge;
