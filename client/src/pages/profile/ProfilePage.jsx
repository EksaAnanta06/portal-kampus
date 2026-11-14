// FILE: client/src/pages/profile/ProfilePage.jsx
import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import useAuthStore from '../../store/useAuthStore';
import { userApi } from '../../api/user.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import {
  ANGKATAN_YEAR_OPTIONS,
  PRODI_LIST,
  ROLE_LABELS,
  USER_STATUS_COLORS,
  USER_STATUS_LABELS,
  getInitials,
} from '../../utils/constants';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    prodi: user?.prodi || PRODI_LIST[0],
    angkatan_year: user?.angkatan_year || new Date().getFullYear(),
    bio: user?.bio || '',
    current_job: user?.current_job || '',
    linkedin_url: user?.linkedin_url || '',
    instagram_url: user?.instagram_url || '',
    github_url: user?.github_url || '',
    is_public_profile: Boolean(user?.is_public_profile ?? 1),
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  const handleSelectAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'is_public_profile') {
          formData.append(key, val ? 'true' : 'false');
        } else if (val !== null && val !== undefined) {
          formData.append(key, String(val));
        }
      });
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await userApi.updateProfile(formData);
      setUser(res.data.user);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memperbarui profil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Pengaturan Akun
        </span>
        <h1 className="section-title mt-1">Profil Saya</h1>
        <p className="text-muted mb-0 mt-2 text-sm">
          Kelola informasi identitas, foto profil, dan visibilitas akun Anda di Direktori Kampus Pasim.
        </p>
      </div>

      <div className="card-surface p-4 sm:p-8">
        {/* Status Verifikasi Banner */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-200 dark:border-slate-800 dark:bg-navy-800">
          <div>
            <span className="text-xs font-semibold text-slate-500">Status Akun & NIM</span>
            <div className="mt-1 flex items-center gap-2">
              <Chip
                label={USER_STATUS_LABELS[user?.status] || user?.status}
                color={USER_STATUS_COLORS[user?.status] || 'default'}
                size="small"
                className="!font-bold"
              />
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                NIM: {user?.nim}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500">Peran Sistem</span>
            <div className="text-sm font-bold text-pasim dark:text-pasim-300">
              {ROLE_LABELS[user?.role] || user?.role}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Picker */}
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative">
              <Avatar
                src={getOptimizedImageUrl(avatarPreview, { width: 180, height: 180 })}
                sx={{ width: 100, height: 100, fontSize: 32, bgcolor: 'primary.main' }}
                className="shadow-md"
              >
                {getInitials(form.full_name || user?.full_name)}
              </Avatar>
              <label
                htmlFor="avatar-input"
                className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-pasim text-white shadow hover:bg-pasim-700 transition"
                title="Ganti foto avatar"
              >
                <PhotoCameraRoundedIcon sx={{ fontSize: 18 }} />
              </label>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleSelectAvatar}
                className="hidden"
              />
            </div>

            <div>
              <h4 className="m-0 text-base font-bold text-slate-900 dark:text-white">Foto Profil</h4>
              <p className="text-muted mb-0 mt-1 text-xs">
                Format JPG, PNG, atau WEBP. Maksimal 5 MB.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nama Lengkap"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />

            <TextField
              label="Alamat Email (Akun)"
              value={user?.email || ''}
              disabled
              helperText="Email terhubung tidak dapat diubah sembarangan"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              select
              label="Program Studi"
              value={form.prodi}
              onChange={(e) => setForm((f) => ({ ...f, prodi: e.target.value }))}
              required
            >
              {PRODI_LIST.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Tahun Masuk / Angkatan"
              value={form.angkatan_year}
              onChange={(e) => setForm((f) => ({ ...f, angkatan_year: Number(e.target.value) }))}
              required
            >
              {ANGKATAN_YEAR_OPTIONS.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <TextField
            label="Pekerjaan / Instansi Saat Ini (Khususnya Alumni)"
            placeholder="Contoh: Software Engineer di PT Telkom Indonesia"
            value={form.current_job}
            onChange={(e) => setForm((f) => ({ ...f, current_job: e.target.value }))}
          />

          <TextField
            label="Bio Singkat"
            multiline
            minRows={3}
            placeholder="Ceritakan minat karier, pengalaman organisasi di PASIM, atau keahlian Anda..."
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 500) }))}
            helperText={`${form.bio.length}/500`}
          />

          {/* Media Sosial */}
          <div className="space-y-4">
            <h4 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">
              Tautan Jejaring Sosial & Portofolio
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="URL LinkedIn"
                placeholder="https://linkedin.com/in/..."
                value={form.linkedin_url}
                onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
              />
              <TextField
                label="URL Instagram"
                placeholder="https://instagram.com/..."
                value={form.instagram_url}
                onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))}
              />
              <TextField
                label="URL GitHub"
                placeholder="https://github.com/..."
                value={form.github_url}
                onChange={(e) => setForm((f) => ({ ...f, github_url: e.target.value }))}
              />
            </div>
          </div>

          {/* Privacy Switch */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_public_profile}
                  onChange={(e) => setForm((f) => ({ ...f, is_public_profile: e.target.checked }))}
                  color="primary"
                />
              }
              label={
                <div>
                  <span className="block text-sm font-bold">Tampilkan di Direktori Kampus</span>
                  <span className="text-muted block text-xs">
                    Jika dinonaktifkan, profil Anda tidak akan muncul dalam pencarian direktori publik mahasiswa & alumni.
                  </span>
                </div>
              }
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveRoundedIcon />}
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
