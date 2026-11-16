// FILE: client/src/components/focus/FocusCompletionDialog.jsx
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import useFocusTimer from '../../hooks/useFocusTimer';

export default function FocusCompletionDialog({ onTaskCompleted }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const {
    completionPromptSession,
    actionLoading,
    submitCompletionPrompt,
    dismissCompletionPrompt,
  } = useFocusTimer();

  const [catatan, setCatatan] = useState('');
  const [markDone, setMarkDone] = useState(false);

  useEffect(() => {
    if (completionPromptSession) {
      setCatatan(completionPromptSession.catatan || '');
      setMarkDone(false);
    }
  }, [completionPromptSession]);

  if (!completionPromptSession) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitCompletionPrompt({
      catatan: catatan.trim(),
      tandai_tugas_selesai: markDone,
    });
    if (markDone && onTaskCompleted) {
      onTaskCompleted(completionPromptSession.tugas_id);
    }
    window.dispatchEvent(new CustomEvent('pasim-focus-data-updated'));
  };

  const innerContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircleRoundedIcon />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-extrabold text-slate-900 dark:text-white">
            Sesi Fokus Selesai!
          </h3>
          <p className="m-0 text-xs text-slate-500 dark:text-slate-400 truncate">
            {completionPromptSession.judul_tugas || 'Sesi fokus bebas'}
          </p>
        </div>
      </div>

      <TextField
        label="Tambah catatan progres? (Opsional)"
        placeholder="Misal: Bab 2 selesai diringkas, lanjut uji coba kode besok..."
        multiline
        minRows={2}
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        inputProps={{ maxLength: 500 }}
      />

      {completionPromptSession.tugas_id && (
        <FormControlLabel
          control={
            <Checkbox
              checked={markDone}
              onChange={(e) => setMarkDone(e.target.checked)}
              color="success"
            />
          }
          label={
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Tugas sudah selesai? (langsung perbarui status di daftar tugas)
            </span>
          }
        />
      )}

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <Button
          type="button"
          color="inherit"
          onClick={dismissCompletionPrompt}
          disabled={actionLoading}
          className="!min-h-[44px]"
        >
          Lewati
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="success"
          disabled={actionLoading}
          className="!min-h-[44px]"
        >
          {actionLoading ? 'Menyimpan...' : 'Simpan Progres'}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={Boolean(completionPromptSession)}
        onClose={dismissCompletionPrompt}
        transitionDuration={{ enter: 180, exit: 0 }}
        ModalProps={{ keepMounted: false, closeAfterTransition: false }}
        PaperProps={{
          className:
            'rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-white dark:bg-navy-800',
        }}
      >
        {innerContent}
      </Drawer>
    );
  }

  return (
    <Dialog
      open={Boolean(completionPromptSession)}
      onClose={dismissCompletionPrompt}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle className="!sr-only">Sesi Fokus Selesai</DialogTitle>
      <DialogContent className="!pt-5">{innerContent}</DialogContent>
      <DialogActions className="!hidden" />
    </Dialog>
  );
}
