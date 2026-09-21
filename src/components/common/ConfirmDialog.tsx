import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'error' for destructive/leave actions, 'primary' otherwise. */
  confirmColor?: 'error' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A styled confirmation popup used in place of the browser's native `window.confirm`.
 * Async by nature — the caller keeps the pending action and runs it in `onConfirm`.
 */
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
  <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
      <WarningAmberRoundedIcon color="warning" />
      {title}
    </DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ color: 'text.primary' }}>{message}</DialogContentText>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Box sx={{ flex: 1 }} />
      <Button onClick={onCancel} variant="outlined" autoFocus>
        {cancelLabel}
      </Button>
      <Button onClick={onConfirm} color={confirmColor} variant="contained">
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
