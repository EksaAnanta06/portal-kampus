// FILE: client/src/components/academic/PdfViewerModal.jsx
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';

export default function PdfViewerModal({ open, onClose, fileUrl, title = 'Pratinjau Dokumen PDF' }) {
  if (!fileUrl) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ className: '!rounded-3xl' }}>
      <DialogTitle className="flex items-center justify-between !py-3 !px-5 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0 pr-4">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-500 hover:text-pasim transition"
            title="Buka di Tab Baru"
          >
            <OpenInNewRoundedIcon sx={{ fontSize: 20 }} />
          </a>
          <a
            href={fileUrl}
            download
            className="p-1.5 text-slate-500 hover:text-pasim transition"
            title="Unduh Berkas"
          >
            <FileDownloadRoundedIcon sx={{ fontSize: 20 }} />
          </a>
          <IconButton size="small" onClick={onClose} aria-label="Tutup">
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className="!p-0 h-[78vh]">
        <iframe
          src={`${fileUrl}#toolbar=1`}
          className="h-full w-full border-0 bg-slate-100 dark:bg-slate-900"
          title={title}
        />
      </DialogContent>
    </Dialog>
  );
}
