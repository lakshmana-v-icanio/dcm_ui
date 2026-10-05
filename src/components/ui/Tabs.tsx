import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface TabsProps {
  value: string;
  onChange: (val: string) => void;
  children: ReactNode;
  className?: string;
}

interface TabProps {
  value: string;
  label: string;
  icon?: ReactNode;
  className?: string;
  activeValue?: string;
  onSelect?: (val: string) => void;
}

interface TabPanelProps {
  value: string;
  active: string;
  children: ReactNode;
  keepMounted?: boolean;
}

export const Tabs = ({ value, onChange, children, className }: TabsProps) => {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={cn('flex items-end gap-0 border-b border-slate-200', className)}>
      {items.map((child) => {
        if (!child || typeof child !== 'object' || !('props' in child)) return child;
        return {
          ...child,
          props: { ...child.props, activeValue: value, onSelect: onChange },
        };
      })}
    </div>
  );
};

export const Tab = ({ value, label, icon, className, activeValue, onSelect }: TabProps) => {
  const isActive = value === activeValue;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect?.(value)}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
        isActive
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
        className
      )}
    >
      {icon && <span className="flex items-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {label}
    </button>
  );
};

export const TabPanel = ({ value, active, children, keepMounted = true }: TabPanelProps) => {
  if (!keepMounted && value !== active) return null;
  return (
    <div role="tabpanel" hidden={value !== active} className={cn(value !== active && 'hidden')}>
      {children}
    </div>
  );
};

export default Tabs;
