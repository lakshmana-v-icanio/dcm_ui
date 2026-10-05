import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import {
  CheckCircle,
  Info,
  AlertTriangle,
  XCircle,
  HourglassIcon,
} from 'lucide-react';

type AlertSeverity = 'success' | 'info' | 'warning' | 'error';

interface AlertProps {
  severity?: AlertSeverity;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  variant?: 'outlined' | 'filled' | 'standard';
  className?: string;
}

const configs: Record<AlertSeverity, { bg: string; border: string; icon: ReactNode; text: string; titleText: string }> = {
  success: {
    bg: 'bg-success-50',
    border: 'border-success-200',
    icon: <CheckCircle className="w-4 h-4 text-success-600 shrink-0" />,
    text: 'text-success-800',
    titleText: 'text-success-900',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Info className="w-4 h-4 text-blue-600 shrink-0" />,
    text: 'text-blue-800',
    titleText: 'text-blue-900',
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    icon: <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0" />,
    text: 'text-warning-800',
    titleText: 'text-warning-900',
  },
  error: {
    bg: 'bg-error-50',
    border: 'border-error-200',
    icon: <XCircle className="w-4 h-4 text-error-600 shrink-0" />,
    text: 'text-error-800',
    titleText: 'text-error-900',
  },
};

export const AlertTitle = ({ children }: { children: ReactNode }) => (
  <p className="font-semibold mb-0.5 text-sm">{children}</p>
);

export const Alert = ({ severity = 'info', title, children, icon, onClose, variant = 'standard', className }: AlertProps) => {
  const c = configs[severity];
  const isOutlined = variant === 'outlined';
  const isFilled = variant === 'filled';

  return (
    <div className={cn(
      'flex gap-2.5 rounded-md px-3 py-2.5 text-sm border',
      isOutlined ? cn('bg-white', c.border, c.text) : isFilled ? 'text-white border-transparent' : cn(c.bg, c.border, c.text),
      isFilled && severity === 'success' && 'bg-success-600',
      isFilled && severity === 'info' && 'bg-blue-600',
      isFilled && severity === 'warning' && 'bg-warning-600',
      isFilled && severity === 'error' && 'bg-error-600',
      className
    )}>
      <span className="mt-0.5">{icon ?? c.icon}</span>
      <div className="flex-1 min-w-0">
        {title && <AlertTitle>{title}</AlertTitle>}
        <div className="text-sm">{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="ml-auto shrink-0 opacity-70 hover:opacity-100 transition-opacity">
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export { HourglassIcon };
export default Alert;
