// FILE: client/src/components/academic/MaterialRulesModal.jsx
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';

export default function MaterialRulesModal({ open, onClose }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ className: '!rounded-none sm:!rounded-3xl' }}
    >
      <DialogTitle className="!font-black !text-base sm:!text-lg !flex !items-center !gap-2 !text-emerald-700 dark:!text-emerald-400">
        <GavelRoundedIcon />
        <span>Aturan Konten & Etika Berbagi Materi (Peer-to-Peer)</span>
      </DialogTitle>
      <DialogContent dividers className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            Perpustakaan ini dibangun dengan semangat gotong-royong akademik antara mahasiswa tingkat lanjut, alumni, dan adik-adik kelas Universitas Nasional Pasim Bandung untuk saling membantu memahami mata kuliah.
          </p>
        </div>

        <div>
          <h4 className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />
            <span>Konten yang Sangat Dianjurkan Dibagikan:</span>
          </h4>
          <ul className="mt-2 list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
            <li><strong>Ringkasan & Catatan Belajar:</strong> Rangkuman materi buatan sendiri yang mudah dipahami adik kelas.</li>
            <li><strong>Slide & Modul Praktikum:</strong> Slide presentasi, tutorial kode program, dan modul latihan praktikum.</li>
            <li><strong>Soal Latihan Mandiri:</strong> Kumpulan latihan soal dari tahun-tahun sebelumnya untuk bahan belajar ujian.</li>
            <li><strong>Video & Referensi:</strong> Tautan video pembahasan YouTube atau repositori kode GitHub/GitLab.</li>
            <li><strong>Tips Belajar:</strong> Tips sukses mengerjakan proyek mata kuliah atau persiapan sidang.</li>
          </ul>
        </div>

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <h4 className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400">
            <BlockRoundedIcon sx={{ fontSize: 18 }} />
            <span>Konten yang Dilarang Keras (Pelanggaran & Takedown):</span>
          </h4>
          <ul className="mt-2 list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
            <li><strong>Buku / E-Book Bajakan:</strong> Dilarang mengunggah file buku digital komersial tanpa izin pemegang hak cipta resmi.</li>
            <li><strong>Kunci Jawaban Ujian Berlangsung:</strong> Dilarang membocorkan lembar jawaban UTS/UAS yang sedang aktif berjalan.</li>
            <li><strong>Klaim Karya Orang Lain:</strong> Dilarang mengunggah tugas/skripsi orang lain dan mengakunya sebagai karya sendiri. Gunakan field <em>Sumber/Kredit</em> jika merujuk referensi karya pihak lain.</li>
            <li><strong>Konten Tidak Pantas & Spam:</strong> Dilarang menyisipkan materi yang mengandung malware, pornografi, ujaran kebencian, atau promosi komersial di luar pembelajaran.</li>
          </ul>
        </div>

        <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
          <p className="text-xs">
            ⚠️ <strong>Sistem Moderasi & Laporan:</strong> Setiap materi baru akan ditinjau oleh Admin/Moderator. Pengguna lain dapat melaporkan materi yang melanggar hak cipta/etika, dan moderator berhak melakukan penurunan konten (<em>takedown</em>).
          </p>
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="success" sx={{ borderRadius: 2 }}>
          Saya Mengerti & Setuju
        </Button>
      </DialogActions>
    </Dialog>
  );
}
