import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SnackbarProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  autoHideDuration?: number;
  anchorOrigin?: { vertical: 'top' | 'bottom'; horizontal: 'left' | 'center' | 'right' };
}

export const Snackbar = ({ open, onClose, children, autoHideDuration, anchorOrigin = { vertical: 'bottom', horizontal: 'right' } }: SnackbarProps) => {
  useEffect(() => {
    if (!open || !autoHideDuration) return;
    const id = setTimeout(onClose, autoHideDuration);
    return () => clearTimeout(id);
  }, [open, autoHideDuration, onClose]);

  if (!open) return null;

  const v = anchorOrigin.vertical === 'top' ? 'top-4' : 'bottom-4';
  const h = anchorOrigin.horizontal === 'right' ? 'right-4' : anchorOrigin.horizontal === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-4';

  return (
    <div className={cn('fixed z-[9999] flex', v, h)}>
      {children}
    </div>
  );
};

export default Snackbar;
