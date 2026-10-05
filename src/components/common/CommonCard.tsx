import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CommonCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  gradient?: boolean;
  className?: string;
}

const CommonCard = ({ title, subtitle, icon, actions, children, className }: CommonCardProps) => (
  <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
    {(title || icon) && (
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export default CommonCard;
