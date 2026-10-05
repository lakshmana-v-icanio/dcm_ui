import { Fragment, type ReactNode } from 'react';
import { Dialog as HDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const widths: Record<string, string> = {
  xs: 'max-w-sm',
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export const Dialog = ({ open, onClose, children, maxWidth = 'md', className }: DialogProps) => (
  <Transition appear show={open} as={Fragment}>
    <HDialog as="div" className="relative z-50" onClose={onClose}>
      <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-black/40" />
      </TransitionChild>
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <DialogPanel className={cn('w-full bg-white rounded-2xl shadow-2xl flex flex-col', widths[maxWidth], className)}>
              {children}
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </HDialog>
  </Transition>
);

export const DialogHeader = ({ title, subtitle, onClose, icon, children }: { title?: string; subtitle?: string; onClose?: () => void; icon?: ReactNode; children?: ReactNode }) => (
  <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
    {icon && <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white shrink-0">{icon}</div>}
    <div className="flex-1 min-w-0">
      {title && <DialogTitle className="text-base font-bold text-slate-900">{title}</DialogTitle>}
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      {children}
    </div>
    {onClose && (
      <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

export const DialogBody = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('px-6 py-5 flex-1 overflow-y-auto', className)}>{children}</div>
);

export const DialogFooter = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100', className)}>{children}</div>
);

export default Dialog;
