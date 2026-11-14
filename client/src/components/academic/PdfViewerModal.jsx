// FILE: client/src/components/academic/PdfViewerModal.jsx
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';

export default function PdfViewerModal({ open, onClose, fileUrl, title = 'Pratinjau Dokumen PDF' }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!fileUrl) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ className: '!rounded-none sm:!rounded-3xl flex flex-col' }}
    >
      <DialogTitle className="flex items-center justify-between !py-2.5 !px-4 sm:!px-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="min-w-0 pr-3">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-pasim dark:hover:bg-slate-800 transition"
            title="Buka di Tab Baru"
            aria-label="Buka PDF di tab baru"
          >
            <OpenInNewRoundedIcon sx={{ fontSize: 20 }} />
          </a>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-pasim dark:hover:bg-slate-800 transition"
            title="Unduh Berkas"
            aria-label="Unduh berkas PDF"
          >
            <FileDownloadRoundedIcon sx={{ fontSize: 20 }} />
          </a>
          <IconButton
            onClick={onClose}
            aria-label="Tutup"
            className="!min-h-[44px] !min-w-[44px]"
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className="!p-0 flex-1 min-h-0 h-[78dvh] sm:h-[75vh]">
        <iframe
          src={`${fileUrl}#toolbar=1`}
          className="h-full w-full border-0 bg-slate-100 dark:bg-slate-900"
          title={title}
        />
      </DialogContent>
    </Dialog>
  );
}
