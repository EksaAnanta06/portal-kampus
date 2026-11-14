// FILE: client/src/pages/admin/ManageGalleryPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { galleryApi } from '../../api/gallery.api';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PhotoLightboxModal from '../../components/gallery/PhotoLightboxModal';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import {
  PHOTO_STATUS_COLORS,
  PHOTO_STATUS_LABELS,
  ANGKATAN_YEAR_OPTIONS,
  getInitials,
} from '../../utils/constants';
import { formatDate } from '../../utils/formatDate';

export default function ManageGalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'banners' ? 'banners' : 'photos';

  const [activeTab, setActiveTab] = useState(initialTab);

  // Angkatan Data
  const [angkatanList, setAngkatanList] = useState([]);
  const [loadingAngkatan, setLoadingAngkatan] = useState(true);

  // TAB 1: Foto State & Filters
  const [photos, setPhotos] = useState([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedAngkatanId, setSelectedAngkatanId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Hapus Foto Confirm State
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  // Lightbox Preview
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // TAB 2: Banner Angkatan Modal States
  const [bannerModal, setBannerModal] = useState({ open: false, isEdit: true, angkatan: null });
  const [bannerForm, setBannerForm] = useState({ year: '', title: '', description: '' });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [savingBanner, setSavingBanner] = useState(false);

  // Hapus Angkatan Confirm State
  const [angkatanToDelete, setAngkatanToDelete] = useState(null);
  const [deletingAngkatan, setDeletingAngkatan] = useState(false);

  // 1. Muat Daftar Angkatan
  const fetchAngkatan = useCallback(async () => {
    setLoadingAngkatan(true);
    try {
      const res = await galleryApi.getAngkatanList();
      setAngkatanList(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAngkatan(false);
    }
  }, []);

  // 2. Muat Foto Galeri
  const fetchPhotos = useCallback(
    async (targetPage = 1, append = false) => {
      setLoadingPhotos(true);
      try {
        const res = await galleryApi.getPhotos({
          angkatan_id: selectedAngkatanId || undefined,
          status: selectedStatus || undefined,
          search: searchKeyword || undefined,
          page: targetPage,
          limit: 16,
        });

        if (append) {
          setPhotos((prev) => [...prev, ...(res.data || [])]);
        } else {
          setPhotos(res.data || []);
        }
        setTotalPhotos(res.meta?.total || 0);
        setHasMore(targetPage < (res.meta?.totalPages || 1));
        setPage(targetPage);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Gagal memuat foto galeri.'));
      } finally {
        setLoadingPhotos(false);
      }
    },
    [selectedAngkatanId, selectedStatus, searchKeyword]
  );

  useEffect(() => {
    fetchAngkatan();
  }, [fetchAngkatan]);

  useEffect(() => {
    fetchPhotos(1, false);
  }, [fetchPhotos]);

  const handleTabChange = (_e, val) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // Handler Hapus Foto
  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete) return;
    setDeletingPhoto(true);
    try {
      await galleryApi.deletePhoto(photoToDelete.id);
      toast.success('Foto angkatan berhasil dihapus secara permanen.');
      setPhotos((prev) => prev.filter((p) => p.id !== photoToDelete.id));
      setTotalPhotos((prev) => Math.max(0, prev - 1));
      setPhotoToDelete(null);
      // Refresh count angkatan juga
      fetchAngkatan();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menghapus foto.'));
    } finally {
      setDeletingPhoto(false);
    }
  };

  // Handler Banner Modal
  const openEditBanner = (angkatan) => {
    setBannerModal({ open: true, isEdit: true, angkatan });
    setBannerForm({
      year: angkatan.year,
      title: angkatan.title || '',
      description: angkatan.description || '',
    });
    setBannerFile(null);
    setBannerPreview(angkatan.cover_url || '');
  };

  const openCreateAngkatan = () => {
    setBannerModal({ open: true, isEdit: false, angkatan: null });
    setBannerForm({
      year: new Date().getFullYear(),
      title: '',
      description: '',
    });
    setBannerFile(null);
    setBannerPreview('');
  };

  const handleSelectBannerFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    setSavingBanner(true);
    try {
      const formData = new FormData();
      formData.append('title', bannerForm.title.trim());
      formData.append('description', bannerForm.description.trim());
      if (bannerFile) {
        formData.append('cover', bannerFile);
      }

      if (bannerModal.isEdit) {
        await galleryApi.updateAngkatan(bannerModal.angkatan.id, formData);
        toast.success(`Banner Card Angkatan ${bannerModal.angkatan.year} berhasil diperbarui.`);
      } else {
        formData.append('year', String(bannerForm.year));
        await galleryApi.createAngkatan(formData);
        toast.success(`Angkatan ${bannerForm.year} berhasil ditambahkan.`);
      }

      setBannerModal({ open: false, isEdit: true, angkatan: null });
      fetchAngkatan();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingBanner(false);
    }
  };

  // Handler Hapus Angkatan
  const handleConfirmDeleteAngkatan = async () => {
    if (!angkatanToDelete) return;
    setDeletingAngkatan(true);
    try {
      await galleryApi.deleteAngkatan(angkatanToDelete.id);
      toast.success(`Galeri Angkatan ${angkatanToDelete.year} berhasil dinonaktifkan.`);
      setAngkatanToDelete(null);
      fetchAngkatan();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingAngkatan(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pasim dark:text-pasim-300">
          Panel Kurasi & Arsip Kampus
        </span>
        <h1 className="section-title mt-1">Kelola Foto Angkatan & Banner Card</h1>
        <p className="text-muted mb-0 mt-2 text-sm max-w-2xl">
          Atur foto sampul (banner card) angkatan resmi kampus, serta pantau dan hapus foto dokumentasi yang tidak sesuai di galeri mahasiswa & alumni.
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab
            value="photos"
            icon={<PhotoLibraryRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={`Hapus & Kelola Foto Galeri (${totalPhotos})`}
          />
          <Tab
            value="banners"
            icon={<CollectionsBookmarkRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={`Banner / Sampul Card Angkatan (${angkatanList.length})`}
          />
        </Tabs>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: KELOLA & HAPUS FOTO ANGKATAN                          */}
      {/* ============================================================ */}
      {activeTab === 'photos' && (
        <div className="space-y-5">
          {/* Box Penjelasan Singkat */}
          <Alert severity="info" className="!rounded-2xl" icon={<InfoOutlinedIcon />}>
            <div>
              <strong className="block text-sm">Menghapus Foto Galeri Dokumentasi:</strong>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                Gunakan tab ini untuk mencari dan menghapus foto-foto kegiatan/momen yang diunggah mahasiswa atau alumni. 
                Foto yang dihapus di sini akan hilang permanen dari database kampus dan penyimpanan cloud Cloudinary.
              </span>
            </div>
          </Alert>

          {/* Filter Bar */}
          <div className="card-surface grid gap-3 p-4 sm:p-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              select
              size="small"
              label="Pilih Tahun Angkatan"
              value={selectedAngkatanId}
              onChange={(e) => setSelectedAngkatanId(e.target.value)}
            >
              <MenuItem value="">Semua Angkatan</MenuItem>
              {angkatanList.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  Angkatan {a.year} {a.title?.includes('—') ? `(${a.title.split('—')[1].trim()})` : ''}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Status Foto"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <MenuItem value="all">Semua Status Foto</MenuItem>
              <MenuItem value="approved">Tayang (Disetujui)</MenuItem>
              <MenuItem value="pending">Menunggu Moderasi</MenuItem>
              <MenuItem value="rejected">Ditolak</MenuItem>
            </TextField>

            <TextField
              placeholder="Cari caption, nama, NIM..."
              value={searchKeyword}
              size="small"
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="lg:col-span-2"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" className="text-slate-400" />
                  </InputAdornment>
                ),
              }}
            />
          </div>

          {/* Grid Foto untuk Dikelola/Dihapus */}
          {loadingPhotos && photos.length === 0 ? (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card-surface p-4 space-y-3">
                  <Skeleton variant="rectangular" height={180} className="!rounded-xl" />
                  <Skeleton width="60%" />
                  <Skeleton width="40%" />
                </div>
              ))}
            </div>
          ) : photos.length === 0 ? (
            <EmptyState
              title="Tidak ada foto galeri ditemukan"
              description="Tidak ada foto dokumentasi yang cocok dengan filter angkatan, status, atau pencarian Anda."
            />
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {photos.map((item) => (
                <div
                  key={item.id}
                  className="card-surface group flex flex-col overflow-hidden transition duration-300 hover:shadow-lg"
                >
                  {/* Thumbnail foto */}
                  <div
                    onClick={() => {
                      setSelectedPhotoId(item.id);
                      setLightboxOpen(true);
                    }}
                    className="relative aspect-video cursor-zoom-in overflow-hidden bg-slate-100 dark:bg-slate-800"
                  >
                    <img
                      src={getOptimizedImageUrl(item.url, { width: 480, height: 280 })}
                      alt={item.caption}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <span className="absolute bottom-2 left-2 rounded-lg bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                      Angkatan {item.angkatan_year}
                    </span>
                    <Chip
                      size="small"
                      label={PHOTO_STATUS_LABELS[item.status] || item.status}
                      color={PHOTO_STATUS_COLORS[item.status] || 'default'}
                      className="!absolute right-2 top-2 shadow !text-[10px]"
                    />
                  </div>

                  {/* Info Pengunggah & Caption */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        src={getOptimizedImageUrl(item.uploader_avatar, { width: 48, height: 48 })}
                        sx={{ width: 28, height: 28, fontSize: 11 }}
                      >
                        {getInitials(item.uploader_name)}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-800 dark:text-white">
                          {item.uploader_name}
                        </div>
                        <div className="text-muted truncate text-[10px]">
                          {item.uploader_nim} · {item.uploader_prodi}
                        </div>
                      </div>
                    </div>

                    <p className="m-0 line-clamp-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {item.caption || <span className="italic text-slate-400">Tanpa caption</span>}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{formatDate(item.created_at)}</span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <FavoriteRoundedIcon sx={{ fontSize: 13 }} className="text-pink-400" />
                          {item.like_count || 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />
                          {item.comment_count || 0}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Aksi Hapus Khusus Admin */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between dark:border-slate-800">
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        fullWidth
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onClick={() => setPhotoToDelete(item)}
                        className="!text-xs !font-bold"
                      >
                        Hapus Foto Ini
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tombol Muat Lebih Banyak */}
          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                variant="outlined"
                size="large"
                onClick={() => fetchPhotos(page + 1, true)}
                disabled={loadingPhotos}
              >
                {loadingPhotos ? 'Memuat...' : 'Muat Lebih Banyak Foto'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: KELOLA BANNER / SAMPUL CARD ANGKATAN                  */}
      {/* ============================================================ */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
          {/* Penjelasan Perbedaan Banner Card vs Foto Galeri */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 sm:p-5 dark:border-amber-800/60 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <WarningAmberRoundedIcon className="text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                <span className="font-bold text-amber-800 dark:text-amber-300 text-sm sm:text-base block">
                  Perbedaan Antara Banner Card Angkatan vs Foto Galeri
                </span>
                <p className="m-0 leading-relaxed">
                  <strong>1. Banner / Sampul Card Angkatan (Bagian Ini):</strong> Gambar sampul lanskap (landscape 16:9) resmi yang tampil sebagai kartu sampul depan tahun angkatan di Beranda publik dan halaman galeri angkatan.
                </p>
                <p className="m-0 leading-relaxed">
                  <strong>2. Foto Galeri Dokumentasi (Tab Sebelah):</strong> Kumpulan banyak foto momen kegiatan mahasiswa (Ospek, praktikum, wisuda, KKN, makrab) yang diunggah sivitas akademika ke dalam album angkatan.
                </p>
              </div>
            </div>
          </div>

          {/* Action Header Banner */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white m-0">
                Daftar Kartu Angkatan & Foto Sampul Saat Ini
              </h2>
              <span className="text-xs text-muted">
                Klik &quot;Ubah Banner Card&quot; pada angkatan terkait untuk mengganti gambar sampul card.
              </span>
            </div>

            <Button
              variant="contained"
              startIcon={<AddPhotoAlternateRoundedIcon />}
              onClick={openCreateAngkatan}
              className="!w-full sm:!w-auto !font-bold"
            >
              Tambah Angkatan Baru
            </Button>
          </div>

          {/* List Card Angkatan */}
          {loadingAngkatan ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card-surface overflow-hidden">
                  <Skeleton variant="rectangular" height={190} />
                  <div className="p-4 space-y-2">
                    <Skeleton width="50%" />
                    <Skeleton width="80%" />
                  </div>
                </div>
              ))}
            </div>
          ) : angkatanList.length === 0 ? (
            <EmptyState title="Belum ada data angkatan" />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {angkatanList.map((item) => {
                const cover = item.cover_url;
                const nickname = item.title?.includes('—')
                  ? item.title.split('—')[1].trim()
                  : item.title;

                return (
                  <div
                    key={item.id}
                    className="card-surface group flex flex-col overflow-hidden transition duration-300 hover:shadow-xl"
                  >
                    {/* Visual Card Cover Landscape */}
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-pasim-700 to-navy">
                      {cover ? (
                        <img
                          src={cover}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/30">
                          <PhotoLibraryRoundedIcon sx={{ fontSize: 56 }} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gold-light">
                          Banner Card
                        </span>
                        <div className="text-3xl font-extrabold text-white leading-none">
                          {item.year}
                        </div>
                      </div>
                    </div>

                    {/* Informasi Card */}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="m-0 text-base font-bold text-slate-900 dark:text-white">
                        {nickname || `Angkatan ${item.year}`}
                      </h3>
                      {item.description && (
                        <p className="text-muted mb-0 mt-1 line-clamp-2 text-xs leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span><strong>{item.photo_count || 0}</strong> foto tersimpan</span>
                        <span>·</span>
                        <span><strong>{item.album_count || 0}</strong> album</span>
                      </div>

                      {/* Tombol Aksi Kelola Banner */}
                      <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2 dark:border-slate-800">
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<CloudUploadRoundedIcon />}
                          onClick={() => openEditBanner(item)}
                          className="!font-bold !text-xs"
                        >
                          Ubah Banner Card & Info
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => setAngkatanToDelete(item)}
                          className="!text-xs"
                        >
                          Nonaktifkan Angkatan
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* DIALOG MODAL EDIT / TAMBAH BANNER CARD ANGKATAN             */}
      {/* ============================================================ */}
      <Dialog
        open={bannerModal.open}
        onClose={() => !savingBanner && setBannerModal((m) => ({ ...m, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={handleSaveBanner}>
          <DialogTitle className="font-bold flex items-center gap-2">
            <CollectionsBookmarkRoundedIcon className="text-pasim" />
            {bannerModal.isEdit
              ? `Ubah Banner Card Angkatan ${bannerModal.angkatan?.year}`
              : 'Tambah Galeri Angkatan & Banner Baru'}
          </DialogTitle>

          <DialogContent className="!pt-3 space-y-4">
            <Alert severity="info" className="!text-xs">
              <strong>Gambar Banner Card:</strong> Gunakan gambar landscape rasio 16:9 berkualitas baik (misal foto bersama angkatan atau gedung kampus Dakota). Gambar ini akan menjadi sampul utama kartu angkatan.
            </Alert>

            {!bannerModal.isEdit && (
              <TextField
                select
                fullWidth
                label="Tahun Angkatan"
                value={bannerForm.year}
                onChange={(e) => setBannerForm((f) => ({ ...f, year: Number(e.target.value) }))}
                required
              >
                {ANGKATAN_YEAR_OPTIONS.map((y) => (
                  <MenuItem key={y} value={y}>
                    Tahun {y}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              fullWidth
              label="Nama Julukan / Gelar Angkatan (Contoh: Prawira Sankara)"
              value={bannerForm.title}
              onChange={(e) => setBannerForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Angkatan 2024 — Nama Julukan"
              required
            />

            <TextField
              fullWidth
              label="Deskripsi / Selayang Pandang Angkatan"
              multiline
              minRows={2}
              value={bannerForm.description}
              onChange={(e) => setBannerForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ceritakan gambaran singkat tentang generasi angkatan ini..."
            />

            {/* Input File Banner Landscape */}
            <div>
              <span className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                Pilih File Gambar Sampul / Banner Card (Landscape 16:9)
              </span>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-pasim hover:bg-pasim-50/40 dark:border-slate-700 dark:bg-slate-800/40">
                {bannerPreview ? (
                  <div className="space-y-2">
                    <img
                      src={bannerPreview}
                      alt="Banner Preview"
                      className="max-h-44 w-auto rounded-xl object-cover shadow-sm mx-auto"
                    />
                    <span className="block text-xs font-semibold text-pasim dark:text-pasim-300">
                      Klik untuk mengganti gambar banner ini
                    </span>
                  </div>
                ) : (
                  <>
                    <CloudUploadRoundedIcon className="text-pasim" sx={{ fontSize: 40 }} />
                    <span className="mt-2 text-xs font-bold text-slate-800 dark:text-white">
                      Klik untuk memilih file banner card (JPG, PNG, WEBP)
                    </span>
                    <span className="text-[11px] text-muted mt-0.5">
                      Rasio rekomendasi: 16:9 atau 1200 x 675 px (Maks. 5 MB)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleSelectBannerFile}
                  className="hidden"
                />
              </label>
            </div>
          </DialogContent>

          <DialogActions className="!px-6 !pb-5">
            <Button
              color="inherit"
              disabled={savingBanner}
              onClick={() => setBannerModal((m) => ({ ...m, open: false }))}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={savingBanner}
              startIcon={savingBanner ? <CircularProgress size={16} color="inherit" /> : <CheckCircleRoundedIcon />}
            >
              {savingBanner ? 'Menyimpan...' : 'Simpan Banner Card'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CONFIRM DIALOG HAPUS FOTO */}
      <ConfirmDialog
        open={Boolean(photoToDelete)}
        title="Hapus Foto Angkatan?"
        message={`Apakah Anda yakin ingin menghapus foto "${photoToDelete?.caption || 'Dokumentasi'}" oleh ${photoToDelete?.uploader_name}? Foto akan dihapus permanen dari galeri kampus dan penyimpanan Cloudinary.`}
        confirmText="Hapus Foto Permanen"
        confirmColor="error"
        loading={deletingPhoto}
        onConfirm={handleConfirmDeletePhoto}
        onClose={() => !deletingPhoto && setPhotoToDelete(null)}
      />

      {/* CONFIRM DIALOG NONAKTIFKAN ANGKATAN */}
      <ConfirmDialog
        open={Boolean(angkatanToDelete)}
        title={`Nonaktifkan Galeri Angkatan ${angkatanToDelete?.year}?`}
        message={`Angkatan ${angkatanToDelete?.year} (${angkatanToDelete?.title}) tidak akan tampil lagi di daftar publik.`}
        confirmText="Nonaktifkan"
        confirmColor="error"
        loading={deletingAngkatan}
        onConfirm={handleConfirmDeleteAngkatan}
        onClose={() => !deletingAngkatan && setAngkatanToDelete(null)}
      />

      {/* Lightbox Modal untuk Preview Foto */}
      <PhotoLightboxModal
        open={lightboxOpen}
        photoId={selectedPhotoId}
        photos={photos}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(id) => setSelectedPhotoId(id)}
        onPhotoDeleted={(deletedId) => {
          setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
          setTotalPhotos((prev) => Math.max(0, prev - 1));
          fetchAngkatan();
        }}
      />
    </div>
  );
}
