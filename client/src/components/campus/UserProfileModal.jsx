// FILE: client/src/components/campus/UserProfileModal.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { userApi } from '../../api/user.api';
import { getErrorMessage } from '../../api/axiosInstance';
import useAuthStore from '../../store/useAuthStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import {
  ROLE_COLORS,
  ROLE_LABELS,
  getInitials,
} from '../../utils/constants';
import { formatShortDate } from '../../utils/formatDate';

export default function UserProfileModal({ open, userId, onClose, onSelectPhoto }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const currentUser = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    userApi
      .getUserProfile(userId)
      .then((res) => {
        setProfile(res.data);
      })
      .catch((err) => {
        setError(getErrorMessage(err, 'Gagal memuat profil pengguna.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, userId]);

  const isMe = Boolean(currentUser && profile && currentUser.id === profile.id);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
      PaperProps={{
        className: '!rounded-2xl overflow-hidden max-h-[92vh]',
      }}
    >
      <DialogTitle className="flex items-center justify-between !py-3 !px-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <SchoolRoundedIcon className="text-pasim dark:text-pasim-300" fontSize="small" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Profil Sivitas Akademika
          </span>
        </div>
        <IconButton size="small" onClick={onClose}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent className="!p-0 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <CircularProgress size={36} />
            <span className="text-xs text-slate-400">Memuat profil lengkap...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-500 font-medium m-0">{error}</p>
            <Button size="small" variant="outlined" onClick={onClose}>
              Tutup
            </Button>
          </div>
        ) : profile ? (
          <div>
            {/* Banner Header Gradient */}
            <div className="relative h-28 sm:h-32 w-full bg-gradient-to-r from-pasim via-pasim-600 to-amber-600 overflow-hidden">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>

            {/* Avatar & Main Badge */}
            <div className="px-5 sm:px-6 relative pb-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 mb-4 gap-3">
                <div className="relative inline-block self-start">
                  <Avatar
                    src={getOptimizedImageUrl(profile.avatar_url, { width: 200, height: 200 })}
                    sx={{ width: 96, height: 96, fontSize: 32, bgcolor: 'primary.main' }}
                    className="border-4 border-white dark:border-slate-900 shadow-xl"
                  >
                    {getInitials(profile.full_name)}
                  </Avatar>
                  {profile.status === 'active' && (
                    <Tooltip title="Akun Terverifikasi">
                      <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow">
                        <VerifiedUserRoundedIcon sx={{ fontSize: 14 }} />
                      </div>
                    </Tooltip>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Chip
                    size="small"
                    label={ROLE_LABELS[profile.role] || profile.role}
                    color={ROLE_COLORS[profile.role] || 'default'}
                    className="font-bold text-xs"
                  />
                  {isMe ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => {
                        onClose();
                        navigate('/profil');
                      }}
                      sx={{ textTransform: 'none', fontSize: 12, borderRadius: 2 }}
                    >
                      Edit Profil Saya
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Nama, NIM & Info Kampus */}
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0 leading-tight">
                  {profile.full_name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>NIM: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{profile.nim}</strong></span>
                  <span>•</span>
                  <span>{profile.prodi}</span>
                  {profile.angkatan_year && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-pasim dark:text-pasim-300">
                        Angkatan {profile.angkatan_year}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Profesi Saat Ini jika ada */}
              {profile.current_job && (
                <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-pasim-50/60 dark:bg-pasim-950/40 border border-pasim-100 dark:border-pasim-900/60 text-xs sm:text-sm text-pasim-900 dark:text-pasim-200">
                  <WorkRoundedIcon fontSize="small" className="text-pasim shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Profesi / Pekerjaan Saat Ini</span>
                    <strong className="font-semibold">{profile.current_job}</strong>
                  </div>
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <div className="mt-4">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                    Tentang
                  </span>
                  <p className="m-0 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Social / Portfolio Links */}
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.linkedin_url && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ textTransform: 'none', fontSize: 12, borderRadius: 2 }}
                    className="!border-blue-600/40 !text-blue-600 dark:!text-blue-400"
                  >
                    LinkedIn
                  </Button>
                )}
                {profile.github_url && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={profile.github_url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ textTransform: 'none', fontSize: 12, borderRadius: 2 }}
                    className="!border-slate-400 !text-slate-700 dark:!text-slate-300"
                  >
                    GitHub
                  </Button>
                )}
                {profile.instagram_url && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={profile.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ textTransform: 'none', fontSize: 12, borderRadius: 2 }}
                    className="!border-pink-500/40 !text-pink-600 dark:!text-pink-400"
                  >
                    Instagram
                  </Button>
                )}
              </div>

              {/* Galeri Kontribusi Foto */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <PhotoCameraRoundedIcon sx={{ fontSize: 16 }} />
                    <span>Kontribusi Foto Galeri ({profile.total_photos || 0})</span>
                  </div>
                  {profile.angkatan_year && (
                    <Link
                      to={`/angkatan/${profile.angkatan_year}`}
                      onClick={onClose}
                      className="text-xs font-semibold text-pasim hover:underline dark:text-pasim-300 flex items-center gap-0.5"
                    >
                      Buka Angkatan {profile.angkatan_year}
                      <OpenInNewRoundedIcon sx={{ fontSize: 12 }} />
                    </Link>
                  )}
                </div>

                {profile.photos && profile.photos.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {profile.photos.map((ph) => (
                      <div
                        key={ph.id}
                        onClick={() => {
                          onClose();
                          if (onSelectPhoto) {
                            onSelectPhoto(ph.id);
                          } else {
                            navigate(`/angkatan/${ph.angkatan_year}?photo=${ph.id}`);
                          }
                        }}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-slate-900 cursor-pointer shadow-sm"
                        title={ph.caption || 'Foto Galeri'}
                      >
                        <img
                          src={getOptimizedImageUrl(ph.url, { width: 250, height: 250, crop: 'fill' })}
                          alt={ph.caption || 'Foto'}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-end p-1.5">
                          <span className="text-[10px] text-white line-clamp-1 font-medium">
                            {ph.caption || `Angkatan ${ph.angkatan_year}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-xs text-center py-4 bg-slate-50 dark:bg-slate-850 rounded-xl m-0 border border-slate-100 dark:border-slate-800">
                    Pengguna ini belum mengunggah foto ke galeri kampus.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
