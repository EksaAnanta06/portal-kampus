// FILE: client/src/pages/admin/ManageCampusInfoPage.jsx
import { useEffect, useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import { campusApi } from '../../api/campus.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { ANNOUNCEMENT_CATEGORIES, CATEGORY_LABELS, ALLOWED_IMAGE_ACCEPT } from '../../utils/constants';
import { formatDate, formatEventRange, toDateTimeLocalInput, toMysqlDateTime } from '../../utils/formatDate';

export default function ManageCampusInfoPage() {
  const [activeTab, setActiveTab] = useState('announcements');

  // Pengumuman State
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementModal, setAnnouncementModal] = useState({ open: false, isEdit: false, item: null });
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    category: 'umum',
    excerpt: '',
    content: '',
    banner_url: '',
    is_pinned: false,
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');

  // Events State
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventModal, setEventModal] = useState({ open: false, isEdit: false, item: null });
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    location: '',
    organizer: 'BEM UNAS PASIM',
    start_date: '',
    end_date: '',
    registration_link: '',
    banner_url: '',
  });
  const [eventBannerFile, setEventBannerFile] = useState(null);
  const [eventBannerPreview, setEventBannerPreview] = useState('');

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', id: null, title: '' });
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const res = await campusApi.getAnnouncements({ limit: 50 });
      setAnnouncements(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await campusApi.getEvents();
      setEvents(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchEvents();
  }, []);

  useEffect(() => {
    return () => {
      if (bannerPreview && bannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(bannerPreview);
      }
    };
  }, [bannerPreview]);

  useEffect(() => {
    return () => {
      if (eventBannerPreview && eventBannerPreview.startsWith('blob:')) {
        URL.revokeObjectURL(eventBannerPreview);
      }
    };
  }, [eventBannerPreview]);

  // Handler Pengumuman
  const handleSelectBanner = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Gambar banner harus berupa JPG, PNG, atau WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran banner maksimal 5 MB.');
      e.target.value = '';
      return;
    }
    if (bannerPreview && bannerPreview.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreview);
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleRemoveBanner = () => {
    if (bannerPreview && bannerPreview.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreview);
    }
    setBannerFile(null);
    setBannerPreview('');
    setAnnouncementForm((f) => ({ ...f, banner_url: '' }));
  };

  const openCreateAnnouncement = () => {
    setBannerFile(null);
    setBannerPreview('');
    setAnnouncementForm({
      title: '',
      category: 'umum',
      excerpt: '',
      content: '',
      banner_url: '',
      is_pinned: false,
    });
    setAnnouncementModal({ open: true, isEdit: false, item: null });
  };

  const openEditAnnouncement = (item) => {
    setBannerFile(null);
    setBannerPreview(item.banner_url || '');
    setAnnouncementForm({
      title: item.title || '',
      category: item.category || 'umum',
      excerpt: item.excerpt || '',
      content: item.content || '',
      banner_url: item.banner_url || '',
      is_pinned: Boolean(item.is_pinned),
    });
    setAnnouncementModal({ open: true, isEdit: true, item });
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', announcementForm.title.trim());
      formData.append('category', announcementForm.category);
      formData.append('excerpt', announcementForm.excerpt.trim());
      formData.append('content', announcementForm.content.trim());
      formData.append('is_pinned', announcementForm.is_pinned ? 'true' : 'false');

      if (bannerFile) {
        formData.append('banner', bannerFile);
      } else if (announcementForm.banner_url !== undefined) {
        formData.append('banner_url', announcementForm.banner_url || '');
      }

      if (announcementModal.isEdit) {
        await campusApi.updateAnnouncement(announcementModal.item.id, formData);
        toast.success('Pengumuman berhasil diperbarui.');
      } else {
        await campusApi.createAnnouncement(formData);
        toast.success('Pengumuman berhasil diterbitkan.');
      }
      setAnnouncementModal({ open: false, isEdit: false, item: null });
      fetchAnnouncements();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Handler Events
  const openCreateEvent = () => {
    setEventForm({
      title: '',
      description: '',
      location: '',
      organizer: 'BEM UNAS PASIM',
      start_date: '',
      end_date: '',
      registration_link: '',
      banner_url: '',
    });
    setEventBannerFile(null);
    setEventBannerPreview('');
    setEventModal({ open: true, isEdit: false, item: null });
  };

  const openEditEvent = (item) => {
    setEventForm({
      title: item.title || '',
      description: item.description || '',
      location: item.location || '',
      organizer: item.organizer || '',
      start_date: toDateTimeLocalInput(item.start_date),
      end_date: toDateTimeLocalInput(item.end_date),
      registration_link: item.registration_link || '',
      banner_url: item.banner_url || '',
    });
    setEventBannerFile(null);
    setEventBannerPreview(item.banner_url || '');
    setEventModal({ open: true, isEdit: true, item });
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', eventForm.title.trim());
      formData.append('description', eventForm.description.trim());
      formData.append('location', eventForm.location.trim());
      formData.append('organizer', eventForm.organizer.trim());
      formData.append('start_date', toMysqlDateTime(eventForm.start_date));
      formData.append('end_date', toMysqlDateTime(eventForm.end_date));
      if (eventForm.registration_link) {
        formData.append('registration_link', eventForm.registration_link.trim());
      }

      if (eventBannerFile) {
        formData.append('banner', eventBannerFile);
      } else if (eventForm.banner_url !== undefined) {
        formData.append('banner_url', eventForm.banner_url || '');
      }

      if (eventModal.isEdit) {
        await campusApi.updateEvent(eventModal.item.id, formData);
        toast.success('Agenda kegiatan berhasil diperbarui.');
      } else {
        await campusApi.createEvent(formData);
        toast.success('Agenda kegiatan berhasil ditambahkan.');
      }
      setEventModal({ open: false, isEdit: false, item: null });
      fetchEvents();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Handler Delete
  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      if (deleteConfirm.type === 'announcement') {
        await campusApi.deleteAnnouncement(deleteConfirm.id);
        toast.success('Pengumuman berhasil dihapus.');
        fetchAnnouncements();
      } else if (deleteConfirm.type === 'event') {
        await campusApi.deleteEvent(deleteConfirm.id);
        toast.success('Agenda berhasil dihapus.');
        fetchEvents();
      }
      setDeleteConfirm({ open: false, type: '', id: null, title: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
            Publikasi Kampus
          </span>
          <h1 className="section-title mt-1">Kelola Pengumuman & Agenda</h1>
          <p className="text-muted mb-0 mt-2 text-sm">
            Terbitkan berita resmi, edaran akademik, serta kalender kegiatan kampus UNAS PASIM Bandung.
          </p>
        </div>

        <div>
          {activeTab === 'announcements' ? (
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={openCreateAnnouncement}
            >
              Tulis Pengumuman
            </Button>
          ) : (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreateEvent}>
              Tambah Agenda
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs value={activeTab} onChange={(_e, val) => setActiveTab(val)}>
          <Tab value="announcements" label={`Pengumuman Kampus (${announcements.length})`} />
          <Tab value="events" label={`Agenda & Kegiatan (${events.length})`} />
        </Tabs>
      </div>

      {/* 1. TAB PENGUMUMAN */}
      {activeTab === 'announcements' && (
        <div className="space-y-3">
          {loadingAnnouncements ? (
            <div className="space-y-3">
              <div className="h-16 bg-slate-200 animate-pulse rounded-xl" />
              <div className="h-16 bg-slate-200 animate-pulse rounded-xl" />
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState title="Belum Ada Pengumuman" />
          ) : (
            announcements.map((item) => (
              <div
                key={item.id}
                className="card-surface flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Chip
                      size="small"
                      label={CATEGORY_LABELS[item.category] || item.category}
                      className="!font-bold"
                    />
                    {Boolean(item.is_pinned) && (
                      <Chip size="small" label="Penting" color="error" variant="outlined" />
                    )}
                    <span className="text-muted text-xs">· {formatDate(item.published_at)}</span>
                  </div>
                  <h3 className="mb-1 mt-2 text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-muted line-clamp-1 text-xs mb-0">{item.excerpt}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => openEditAnnouncement(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() =>
                      setDeleteConfirm({
                        open: true,
                        type: 'announcement',
                        id: item.id,
                        title: item.title,
                      })
                    }
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. TAB EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-3">
          {loadingEvents ? (
            <div className="space-y-3">
              <div className="h-16 bg-slate-200 animate-pulse rounded-xl" />
              <div className="h-16 bg-slate-200 animate-pulse rounded-xl" />
            </div>
          ) : events.length === 0 ? (
            <EmptyState title="Belum Ada Agenda" />
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="card-surface flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <h3 className="m-0 text-base font-bold text-slate-900 dark:text-white">
                    {ev.title}
                  </h3>
                  <div className="text-muted mt-1 text-xs">
                    {formatEventRange(ev.start_date, ev.end_date)} · {ev.location}
                  </div>
                  <div className="text-muted text-[11px] mt-0.5">
                    Penyelenggara: {ev.organizer}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => openEditEvent(ev)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={() =>
                      setDeleteConfirm({
                        open: true,
                        type: 'event',
                        id: ev.id,
                        title: ev.title,
                      })
                    }
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL FORM PENGUMUMAN */}
      <Dialog
        open={announcementModal.open}
        onClose={() => !saving && setAnnouncementModal((m) => ({ ...m, open: false }))}
        fullWidth
        maxWidth="md"
      >
        <form onSubmit={handleSaveAnnouncement}>
          <DialogTitle className="font-bold">
            {announcementModal.isEdit ? 'Edit Pengumuman Kampus' : 'Terbitkan Pengumuman Baru'}
          </DialogTitle>
          <DialogContent className="!pt-3 space-y-4">
            <TextField
              label="Judul Pengumuman"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                select
                label="Kategori"
                value={announcementForm.category}
                onChange={(e) => setAnnouncementForm((f) => ({ ...f, category: e.target.value }))}
              >
                {ANNOUNCEMENT_CATEGORIES.map((c) => (
                  <MenuItem key={c.value} value={c.value}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Banner / Gambar Pengumuman (Opsional)
                </span>
                {bannerPreview ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <img
                      src={bannerPreview}
                      alt="Banner Preview"
                      className="max-h-36 w-full object-cover"
                    />
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={handleRemoveBanner}
                      startIcon={<DeleteForeverRoundedIcon />}
                      className="!absolute bottom-2 right-2 !bg-red-600/90 hover:!bg-red-700"
                    >
                      Hapus Gambar
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-pasim hover:bg-pasim-50/30 dark:border-slate-700 dark:bg-slate-800/40">
                    <CloudUploadRoundedIcon className="text-pasim dark:text-pasim-300" sx={{ fontSize: 30 }} />
                    <span className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Pilih file gambar banner
                    </span>
                    <span className="text-[10px] text-slate-400">JPG, PNG, atau WEBP (Maks 5 MB)</span>
                    <input
                      type="file"
                      accept={ALLOWED_IMAGE_ACCEPT}
                      onChange={handleSelectBanner}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <TextField
              label="Ringkasan (Excerpt)"
              multiline
              minRows={2}
              value={announcementForm.excerpt}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, excerpt: e.target.value.slice(0, 300) }))}
              helperText={`${announcementForm.excerpt.length}/300`}
              required
            />

            <TextField
              label="Isi Konten Lengkap"
              multiline
              minRows={6}
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm((f) => ({ ...f, content: e.target.value }))}
              required
            />

            <FormControlLabel
              control={
                <Switch
                  checked={announcementForm.is_pinned}
                  onChange={(e) =>
                    setAnnouncementForm((f) => ({ ...f, is_pinned: e.target.checked }))
                  }
                  color="error"
                />
              }
              label="Sematkan di posisi teratas (Pinned / Penting)"
            />
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button
              color="inherit"
              onClick={() => setAnnouncementModal((m) => ({ ...m, open: false }))}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Pengumuman'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* MODAL FORM EVENT */}
      <Dialog
        open={eventModal.open}
        onClose={() => !saving && setEventModal((m) => ({ ...m, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={handleSaveEvent}>
          <DialogTitle className="font-bold">
            {eventModal.isEdit ? 'Edit Agenda Kampus' : 'Tambah Agenda Kampus Baru'}
          </DialogTitle>
          <DialogContent className="!pt-3 space-y-4">
            <TextField
              label="Nama Agenda / Kegiatan"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Lokasi Acara"
                placeholder="Contoh: Aula Utama UNAS PASIM"
                value={eventForm.location}
                onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
                required
              />

              <TextField
                label="Penyelenggara"
                value={eventForm.organizer}
                onChange={(e) => setEventForm((f) => ({ ...f, organizer: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                type="datetime-local"
                label="Waktu Mulai"
                value={eventForm.start_date}
                onChange={(e) => setEventForm((f) => ({ ...f, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />

              <TextField
                type="datetime-local"
                label="Waktu Selesai"
                value={eventForm.end_date}
                onChange={(e) => setEventForm((f) => ({ ...f, end_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </div>

            <TextField
              label="Link Pendaftaran / Info Registrasi (Opsional)"
              placeholder="https://..."
              value={eventForm.registration_link}
              onChange={(e) => setEventForm((f) => ({ ...f, registration_link: e.target.value }))}
            />

            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Banner / Poster Acara (Opsional)
              </span>
              {eventBannerPreview ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <img
                    src={eventBannerPreview}
                    alt="Event Banner Preview"
                    className="max-h-40 w-full object-cover"
                  />
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    onClick={() => {
                      if (eventBannerPreview && eventBannerPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(eventBannerPreview);
                      }
                      setEventBannerFile(null);
                      setEventBannerPreview('');
                      setEventForm((f) => ({ ...f, banner_url: '' }));
                    }}
                    startIcon={<DeleteForeverRoundedIcon />}
                    className="!absolute bottom-2 right-2 !bg-red-600/90 hover:!bg-red-700"
                  >
                    Hapus Poster
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-4 transition hover:border-pasim hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <AddPhotoAlternateRoundedIcon className="mb-1 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Klik untuk unggah poster / banner agenda
                  </span>
                  <span className="text-[11px] text-slate-400">PNG, JPG, WEBP maks 5MB</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
                        toast.error('Poster harus berupa gambar JPG, PNG, atau WEBP.');
                        e.target.value = '';
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Ukuran poster maksimal 5MB.');
                        e.target.value = '';
                        return;
                      }
                      if (eventBannerPreview && eventBannerPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(eventBannerPreview);
                      }
                      setEventBannerFile(file);
                      setEventBannerPreview(URL.createObjectURL(file));
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            <TextField
              label="Deskripsi Agenda"
              multiline
              minRows={4}
              value={eventForm.description}
              onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button
              color="inherit"
              onClick={() => setEventModal((m) => ({ ...m, open: false }))}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Agenda'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Hapus Konten Ini?"
        message={`Apakah Anda yakin ingin menghapus "${deleteConfirm.title}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteConfirm({ open: false, type: '', id: null, title: '' })}
      />
    </div>
  );
}
