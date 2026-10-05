import { cn } from '../../lib/cn';

interface ProgressProps {
  value?: number;
  variant?: 'determinate' | 'indeterminate';
  tone?: 'primary' | 'success' | 'warning' | 'error';
  barHeight?: number;
  className?: string;
}

const toneBg: Record<string, string> = {
  primary: 'bg-primary-600',
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  error: 'bg-error-600',
};

export const LinearProgress = ({ value = 0, variant = 'determinate', tone = 'primary', barHeight = 4, className }: ProgressProps) => (
  <div className={cn('w-full overflow-hidden rounded-full bg-slate-100', className)} style={{ height: barHeight }}>
    {variant === 'indeterminate' ? (
      <div className={cn('h-full w-1/3 rounded-full animate-indeterminate', toneBg[tone])} />
    ) : (
      <div
        className={cn('h-full rounded-full transition-all duration-300', toneBg[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    )}
  </div>
);

export default LinearProgress;
