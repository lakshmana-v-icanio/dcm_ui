import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface TooltipProps {
  title: string;
  children: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const Tooltip = ({ title, children, className }: TooltipProps) => (
  <span className={cn('group relative inline-flex', className)}>
    {children}
    {title && (
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50">
        <span className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {title}
        </span>
      </span>
    )}
  </span>
);

export default Tooltip;
