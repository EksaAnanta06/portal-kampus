// FILE: client/src/pages/NotFoundPage.jsx
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ExploreOffRoundedIcon from '@mui/icons-material/ExploreOffRounded';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-16 text-center">
      <div className="card-surface max-w-md p-8 sm:p-10">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
          <ExploreOffRoundedIcon sx={{ fontSize: 44 }} />
        </div>
        <span className="text-4xl font-extrabold text-pasim dark:text-pasim-300">404</span>
        <h1 className="mb-2 mt-2 text-2xl font-bold text-slate-900 dark:text-white">Halaman Tidak Ditemukan</h1>
        <p className="text-muted mb-6 text-sm leading-relaxed">
          Maaf, tautan yang Anda tuju mungkin sudah dipindahkan, dihapus, atau belum tersedia di Portal Kampus Pasim.
        </p>
        <Button
          component={Link}
          to="/"
          variant="contained"
          size="large"
          startIcon={<HomeRoundedIcon />}
        >
          Kembali ke Beranda
        </Button>
      </div>
    </div>
  );
}
