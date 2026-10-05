import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'Leave anyway',
  cancelLabel = 'Stay on page',
  confirmColor = 'error',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Dialog open={open} onClose={onCancel} maxWidth="xs">
    <DialogHeader
      title={title}
      icon={<AlertTriangle className="w-5 h-5" />}
      onClose={onCancel}
    />
    <DialogBody>
      <p className="text-sm text-slate-700">{message}</p>
    </DialogBody>
    <DialogFooter>
      <Button variant="outlined" color="inherit" onClick={onCancel} autoFocus>
        {cancelLabel}
      </Button>
      <Button variant="contained" color={confirmColor} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </DialogFooter>
  </Dialog>
);

export default ConfirmDialog;
