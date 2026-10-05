/**
 * Tailwind-based styled component aliases.
 * These mirror the old MUI styled-components API so existing screens
 * can import from this file without changes.
 */
export { Button as BrandButton } from '../components/ui/Button';
export { LinearProgress as BrandLinearProgress } from '../components/ui/Progress';
export { Badge as StatusChip } from '../components/ui/Badge';
export { Spinner } from '../components/ui/Spinner';

// TypeChip — coloured badge for schedule type
import { cn } from '../lib/cn';

interface TypeChipProps {
  label: string;
  size?: 'small' | 'medium';
  colorVariant?: 'primary' | 'secondary';
}

export const TypeChip = ({ label, colorVariant = 'primary' }: TypeChipProps) => {
  const cls = colorVariant === 'primary'
    ? 'bg-primary-100 text-primary-700'
    : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0', cls)}>
      {label}
    </span>
  );
};

// Layout primitives used by screens and wizard
import type { ReactNode, HTMLAttributes } from 'react';
import { createElement } from 'react';

const div = (className: string) =>
  ({ children, className: extra, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
    createElement('div', { className: cn(className, extra as string), ...rest }, children);

export const PageContainer = div('p-6 md:p-8 flex flex-col gap-4');
export const PageLane = div('max-w-screen-xl mx-auto w-full flex flex-col gap-4');
export const ActionBar = div('flex items-center justify-end gap-2');
export const WizardLane = div('max-w-screen-xl mx-auto w-full');
export const WizardPanel = div('bg-white rounded-xl border border-slate-200 shadow-sm');
export const WizardHeader = div('px-6 py-5 border-b border-slate-100');
export const WizardFooter = div('px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3');
export const StepCard = div('bg-white rounded-xl border border-slate-200 shadow-sm p-6');
export const SurfaceCard = div('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden');
export const DraftCard = div('rounded-lg border border-slate-200 p-4 bg-slate-50');
export const ProgressCell = div('');
export const ProgressStack = div('flex flex-col gap-1.5');

export const InlineLoader = () =>
  createElement('div', { className: 'h-0.5 w-full bg-slate-100 overflow-hidden relative' },
    createElement('div', { className: 'h-full w-1/3 bg-primary-600 animate-indeterminate absolute' })
  );

export const OverallProgressCaption = ({ children }: { children?: ReactNode }) =>
  createElement('p', { className: 'text-xs text-slate-500 font-medium' }, children);

export const CodePre = ({ children }: { children?: ReactNode }) =>
  createElement('pre', {
    className: 'text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto whitespace-pre-wrap',
  }, children);
