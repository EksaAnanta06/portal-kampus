// FILE: client/src/pages/admin/AdminDashboardPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import FlakyRoundedIcon from '@mui/icons-material/FlakyRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { campusApi } from '../../api/campus.api';
import useAuthStore, { selectIsAdmin } from '../../store/useAuthStore';

function StatCard({ title, value, icon, link, actionText, alert = false }) {
  return (
    <div
      className={`card-surface flex flex-col justify-between p-6 ${
        alert
          ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-900/10'
          : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">{value}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
          {icon}
        </div>
      </div>

      {link && actionText && (
        <div className="mt-6 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link
            to={link}
            className="text-xs font-bold text-pasim hover:underline dark:text-pasim-300"
          >
            {actionText} →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campusApi
      .getAdminStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Ringkasan & Operasional
        </span>
        <h1 className="section-title mt-1">Dashboard Pengelola Portal Kampus</h1>
        <p className="text-muted mb-0 mt-2 text-sm">
          Pantau antrean kurasi foto, verifikasi pendaftaran akun mahasiswa baru, serta laporan konten sivitas.
        </p>
      </div>

      {/* Action / Alert Cards (Perlu Ditindaklanjuti) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Foto Menunggu Moderasi"
          value={loading ? <Skeleton width={60} /> : stats?.pending_photos || 0}
          icon={<FlakyRoundedIcon />}
          link="/admin/moderasi"
          actionText="Tinjau Antrean Foto"
          alert={Boolean(stats?.pending_photos > 0)}
        />

        <StatCard
          title="Materi & MK Menunggu Izin"
          value={
            loading ? (
              <Skeleton width={60} />
            ) : (
              (stats?.pending_materials || 0) + (stats?.pending_courses || 0)
            )
          }
          icon={<MenuBookRoundedIcon />}
          link="/admin/materi"
          actionText="Beri Izin Tayang"
          alert={Boolean((stats?.pending_materials || 0) + (stats?.pending_courses || 0) > 0)}
        />

        {isAdmin && (
          <StatCard
            title="Akun Menunggu Verifikasi NIM"
            value={loading ? <Skeleton width={60} /> : stats?.pending_users || 0}
            icon={<HowToRegRoundedIcon />}
            link="/admin/pengguna"
            actionText="Verifikasi Mahasiswa/Alumni"
            alert={Boolean(stats?.pending_users > 0)}
          />
        )}

        <StatCard
          title="Laporan Pelanggaran Komunitas"
          value={
            loading ? (
              <Skeleton width={60} />
            ) : (
              (stats?.open_reports || 0) + (stats?.material_reports || 0)
            )
          }
          icon={<ReportProblemRoundedIcon />}
          link="/admin/moderasi?tab=reports"
          actionText="Selesaikan Laporan"
          alert={Boolean((stats?.open_reports || 0) + (stats?.material_reports || 0) > 0)}
        />
      </div>

      {/* Global Portal Stats */}
      <div>
        <h3 className="mb-4 text-base font-bold text-slate-800 dark:text-white">
          Statistik Keseluruhan Sivitas
        </h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Total Foto Disetujui"
            value={loading ? <Skeleton width={60} /> : stats?.approved_photos || 0}
            icon={<PhotoLibraryRoundedIcon />}
            link="/admin/galeri"
            actionText="Kelola & Hapus Foto"
          />
          <StatCard
            title="Materi Kurikulum Aktif"
            value={
              loading ? (
                <Skeleton width={60} />
              ) : (
                `${stats?.total_materials || 0} Materi`
              )
            }
            icon={<MenuBookRoundedIcon />}
            link="/admin/materi"
            actionText="Kelola Katalog MK"
          />
          <StatCard
            title="Mahasiswa Terdaftar"
            value={loading ? <Skeleton width={60} /> : stats?.total_mahasiswa || 0}
            icon={<GroupsRoundedIcon />}
          />
          <StatCard
            title="Alumni Terhubung"
            value={loading ? <Skeleton width={60} /> : stats?.total_alumni || 0}
            icon={<SchoolRoundedIcon />}
          />
          <StatCard
            title="Warta & Agenda Kampus"
            value={
              loading ? (
                <Skeleton width={60} />
              ) : (
                `${stats?.total_announcements || 0} / ${stats?.total_events || 0}`
              )
            }
            icon={<CampaignRoundedIcon />}
          />
        </div>
      </div>
    </div>
  );
}
