// FILE: client/src/components/common/ConfirmDialog.jsx
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

export default function ConfirmDialog({
  open,
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  color = 'error',
  confirmColor,
  loading = false,
  onConfirm,
  onClose,
  onCancel,
  children,
}) {
  const resolvedColor = confirmColor || color;
  const handleClose = onClose || onCancel;

  return (
    <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center gap-3 !pb-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            resolvedColor === 'error'
              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          <WarningAmberRoundedIcon />
        </span>
        <span className="text-lg font-bold">{title}</span>
      </DialogTitle>
      <DialogContent>
        <p className="text-muted m-0 text-sm leading-relaxed">{message}</p>
        {children}
      </DialogContent>
      <DialogActions className="!px-6 !pb-5">
        <Button onClick={handleClose} disabled={loading} color="inherit">
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={resolvedColor}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
