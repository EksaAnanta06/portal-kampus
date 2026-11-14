// FILE: client/src/pages/gallery/AngkatanDetailPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { galleryApi } from '../../api/gallery.api';
import PhotoMasonryGrid from '../../components/gallery/PhotoMasonryGrid';
import PhotoLightboxModal from '../../components/gallery/PhotoLightboxModal';
import UploadPhotoDialog from '../../components/gallery/UploadPhotoDialog';
import EditAngkatanDialog from '../../components/gallery/EditAngkatanDialog';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useAuthStore, { selectIsStaff } from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { getErrorMessage } from '../../api/axiosInstance';
import useCloudinaryUrl from '../../hooks/useCloudinaryUrl';
import useDebounce from '../../hooks/useDebounce';

export default function AngkatanDetailPage() {
  const { yearOrId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const photoParam = searchParams.get('photo');

  const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));
  const isStaff = useAuthStore(selectIsStaff);
  const user = useAuthStore((s) => s.user);

  const [angkatan, setAngkatan] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState('all');
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Daftar Foto
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const debouncedSearch = useDebounce(searchKeyword.trim(), 350);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Dialog & Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Dialog Tambah & Kelola Album
  const [openCreateAlbum, setOpenCreateAlbum] = useState(false);
  const [openManageAlbums, setOpenManageAlbums] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState(null);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [albumForm, setAlbumForm] = useState({ name: '', description: '' });
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  // Dialog Edit Nama Album (Admin, Moderator, & Pembuat Album)
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editAlbumForm, setEditAlbumForm] = useState({ name: '', description: '' });
  const [updatingAlbum, setUpdatingAlbum] = useState(false);

  // Dialog Edit Informasi & Banner Angkatan (Khusus Admin & Moderator)
  const [openEditAngkatan, setOpenEditAngkatan] = useState(false);

  const canManageAlbum = (al) => Boolean(isStaff || (user && al && al.created_by && al.created_by === user.id));

  // 1. Muat Detail Angkatan & Album
  const fetchAngkatanData = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const res = await galleryApi.getAngkatanDetail(yearOrId);
      setAngkatan(res.data.angkatan);
      setAlbums(res.data.albums || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Angkatan tidak ditemukan.'));
    } finally {
      setLoadingDetail(false);
    }
  }, [yearOrId]);

  useEffect(() => {
    fetchAngkatanData();
  }, [fetchAngkatanData]);

  // 2. Muat Foto Angkatan (filter album, search, pagination)
  const fetchPhotos = useCallback(
    async (targetPage = 1, append = false, signal) => {
      if (!angkatan?.id) return;
      setLoadingPhotos(true);
      try {
        const params = {
          angkatan_id: angkatan.id,
          album_id: selectedAlbumId === 'all' ? undefined : selectedAlbumId,
          search: debouncedSearch || undefined,
          page: targetPage,
          limit: 18,
          status: 'approved',
        };
        const res = await galleryApi.getPhotos(params, { signal });
        if (append) {
          setPhotos((prev) => [...prev, ...res.data]);
        } else {
          setPhotos(res.data || []);
        }
        setHasMore(targetPage < (res.meta?.totalPages || 1));
        setPage(targetPage);
      } catch (err) {
        if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
          console.error(err);
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingPhotos(false);
        }
      }
    },
    [angkatan?.id, selectedAlbumId, debouncedSearch]
  );

  useEffect(() => {
    if (!angkatan?.id) return undefined;
    const controller = new AbortController();
    fetchPhotos(1, false, controller.signal);
    return () => controller.abort();
  }, [angkatan?.id, selectedAlbumId, debouncedSearch, fetchPhotos]);

  // Cek deep link photo dari URL (?photo=12)
  useEffect(() => {
    if (photoParam) {
      setSelectedPhotoId(Number(photoParam));
      setLightboxOpen(true);
    }
  }, [photoParam]);

  const handleOpenPhoto = (photo) => {
    setSelectedPhotoId(photo.id);
    setLightboxOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('photo', String(photo.id));
      return next;
    });
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('photo');
      return next;
    }, { replace: true });
  };

  const handlePhotoUpdated = (patch) => {
    setPhotos((prev) => prev.map((p) => (p.id === patch.id ? { ...p, ...patch } : p)));
  };

  const handlePhotoDeleted = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreateAlbumSubmit = async (e) => {
    e.preventDefault();
    if (!albumForm.name.trim()) return;
    setCreatingAlbum(true);
    try {
      const res = await galleryApi.createAlbum({
        angkatan_id: angkatan.id,
        name: albumForm.name.trim(),
        description: albumForm.description.trim() || undefined,
      });
      toast.success(res.message);
      setOpenCreateAlbum(false);
      setAlbumForm({ name: '', description: '' });
      fetchAngkatanData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreatingAlbum(false);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!albumToDelete) return;
    setDeletingAlbum(true);
    try {
      const res = await galleryApi.deleteAlbum(albumToDelete.id);
      toast.success(res.message || `Album "${albumToDelete.name}" berhasil dihapus.`);
      if (selectedAlbumId === albumToDelete.id) {
        setSelectedAlbumId('all');
      }
      setAlbumToDelete(null);
      fetchAngkatanData();
      fetchPhotos(1, false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menghapus album.'));
    } finally {
      setDeletingAlbum(false);
    }
  };

  const handleOpenEditAlbum = (al) => {
    setEditingAlbum(al);
    setEditAlbumForm({
      name: al.name || '',
      description: al.description || '',
    });
  };

  const handleSaveEditAlbum = async (e) => {
    e.preventDefault();
    if (!editingAlbum?.id || !editAlbumForm.name.trim()) return;
    setUpdatingAlbum(true);
    try {
      const res = await galleryApi.updateAlbum(editingAlbum.id, {
        name: editAlbumForm.name.trim(),
        description: editAlbumForm.description.trim() || undefined,
      });
      toast.success(res.message || `Album "${res.data.name}" berhasil diperbarui.`);
      setEditingAlbum(null);
      fetchAngkatanData();
      fetchPhotos(page, false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memperbarui nama album.'));
    } finally {
      setUpdatingAlbum(false);
    }
  };

  const coverUrl = useCloudinaryUrl(angkatan?.cover_url, 'hero');
  const activeAlbum = albums.find((a) => a.id === selectedAlbumId);

  if (!loadingDetail && !angkatan) {
    return (
      <div className="container-page py-16 text-center">
        <EmptyState
          title="Angkatan Tidak Ditemukan"
          description="Silakan periksa kembali tautan yang Anda tuju."
          action={
            <Button component={Link} to="/angkatan" variant="contained">
              Kembali ke Daftar Angkatan
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER ANGKATAN */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-pasim-800 via-pasim-900 to-navy text-white shadow-xl p-5 sm:p-8">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={angkatan?.title}
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between">
          <Link
            to="/angkatan"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-light hover:underline"
          >
            <ArrowBackRoundedIcon fontSize="small" />
            Semua Angkatan
          </Link>

          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="text-3xl font-black text-gold sm:text-5xl">
                {loadingDetail ? <Skeleton width={100} /> : angkatan?.year}
              </span>
              <h1 className="mt-1 text-xl font-extrabold sm:text-3xl lg:text-4xl">
                {loadingDetail ? <Skeleton width={250} /> : angkatan?.title}
              </h1>
              {angkatan?.description && (
                <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-300">
                  {angkatan.description}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              {isLoggedIn ? (
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<CloudUploadRoundedIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                  className="!font-bold shadow-lg !w-full sm:!w-auto"
                >
                  Unggah Foto
                </Button>
              ) : (
                <Button
                  component={Link}
                  to="/login"
                  variant="contained"
                  color="secondary"
                  size="large"
                  className="!w-full sm:!w-auto"
                >
                  Masuk untuk Unggah
                </Button>
              )}

              {isLoggedIn && (
                <Button
                  variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
                  startIcon={<CreateNewFolderRoundedIcon />}
                  onClick={() => setOpenCreateAlbum(true)}
                  className="!w-full sm:!w-auto"
                >
                  Buat Album
                </Button>
              )}

              {isLoggedIn && albums.length > 0 && (
                <Button
                  variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
                  startIcon={<FolderRoundedIcon />}
                  onClick={() => setOpenManageAlbums(true)}
                  className="!w-full sm:!w-auto"
                >
                  Kelola Album ({albums.length})
                </Button>
              )}

              {isStaff && (
                <Button
                  variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(0,0,0,0.3)' }}
                  startIcon={<EditRoundedIcon />}
                  onClick={() => setOpenEditAngkatan(true)}
                  className="!w-full sm:!w-auto !font-bold"
                >
                  Edit Info & Card Angkatan
                </Button>
              )}
            </div>
          </div>

          {/* Quick Counter Info */}
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-200">
            <span className="flex items-center gap-1">
              <PhotoLibraryRoundedIcon sx={{ fontSize: 16 }} />
              {angkatan?.photo_count || 0} Foto Terarsip
            </span>
            <span className="flex items-center gap-1">
              <PeopleAltRoundedIcon sx={{ fontSize: 16 }} />
              {angkatan?.contributor_count || 0} Pengunggah / Kontributor
            </span>
          </div>
        </div>
      </div>

      {/* 2. TABS ALBUM & FILTER */}
      <div className="card-surface p-2.5 sm:p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={selectedAlbumId}
            onChange={(_e, val) => setSelectedAlbumId(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            className="min-h-[44px]"
          >
            <Tab value="all" label="Semua Foto" />
            {albums.map((al) => (
              <Tab
                key={al.id}
                value={al.id}
                label={`${al.name} (${al.photo_count || 0})`}
              />
            ))}
          </Tabs>

          <div className="flex items-center gap-2">
            <TextField
              placeholder="Cari caption / tag..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              size="small"
              className="w-full sm:w-60"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" className="text-slate-400" />
                  </InputAdornment>
                ),
              }}
            />

            {albums.length > 0 && isLoggedIn && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderRoundedIcon />}
                onClick={() => setOpenManageAlbums(true)}
                className="whitespace-nowrap !text-xs !py-2 shrink-0"
              >
                Kelola Album
              </Button>
            )}
          </div>
        </div>

        {/* Action bar jika sedang membuka album tertentu */}
        {selectedAlbumId !== 'all' && activeAlbum && (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 px-3.5 border border-slate-200 dark:border-slate-700/60 dark:bg-slate-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <FolderRoundedIcon className="text-pasim shrink-0" fontSize="small" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate block">
                  Album: {activeAlbum.name} ({activeAlbum.photo_count || 0} foto)
                </span>
                {activeAlbum.description && (
                  <span className="text-[11px] text-muted truncate block">{activeAlbum.description}</span>
                )}
              </div>
            </div>

            {canManageAlbum(activeAlbum) && (
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={<DeleteOutlineRoundedIcon />}
                onClick={() => setAlbumToDelete(activeAlbum)}
                className="shrink-0 !text-xs !font-bold"
              >
                Hapus Album Ini
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 3. MASONRY GRID FOTO */}
      <div>
        {loadingPhotos && photos.length === 0 ? (
          <PhotoMasonryGrid loading skeletonCount={12} />
        ) : photos.length === 0 ? (
          <EmptyState
            title="Belum ada foto yang dipublikasikan"
            description={
              selectedAlbumId !== 'all'
                ? 'Album ini belum memiliki foto yang disetujui.'
                : 'Jadilah yang pertama mengunggah dokumentasi kenangan untuk angkatan ini!'
            }
            action={
              isLoggedIn && (
                <Button
                  variant="contained"
                  startIcon={<CloudUploadRoundedIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Unggah Foto Sekarang
                </Button>
              )
            }
          />
        ) : (
          <>
            <PhotoMasonryGrid
              photos={photos}
              onPhotoClick={handleOpenPhoto}
              showStatus={isStaff}
            />

            {hasMore && (
              <div className="mt-8 text-center">
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => fetchPhotos(page + 1, true)}
                  disabled={loadingPhotos}
                >
                  {loadingPhotos ? 'Memuat...' : 'Muat Lebih Banyak'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox Modal */}
      <PhotoLightboxModal
        open={lightboxOpen}
        photoId={selectedPhotoId}
        photos={photos}
        onClose={handleCloseLightbox}
        onNavigate={(id) => {
          setSelectedPhotoId(id);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('photo', String(id));
            return next;
          }, { replace: true });
        }}
        onPhotoUpdated={handlePhotoUpdated}
        onPhotoDeleted={handlePhotoDeleted}
      />

      {/* Upload Dialog */}
      {angkatan && (
        <UploadPhotoDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          defaultAngkatanId={angkatan.id}
          angkatanList={[angkatan]}
          albums={albums}
          onSuccess={() => {
            fetchPhotos(1, false);
            fetchAngkatanData();
          }}
        />
      )}

      {/* Dialog Buat Album Baru */}
      <Dialog
        open={openCreateAlbum}
        onClose={() => !creatingAlbum && setOpenCreateAlbum(false)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleCreateAlbumSubmit}>
          <DialogTitle className="font-bold">Buat Album Baru</DialogTitle>
          <DialogContent className="!pt-3 space-y-3">
            <TextField
              label="Nama Album"
              placeholder="Contoh: Ospek & PKKMB, KKN, Makrab"
              value={albumForm.name}
              onChange={(e) => setAlbumForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
            <TextField
              label="Keterangan (opsional)"
              multiline
              minRows={2}
              value={albumForm.description}
              onChange={(e) => setAlbumForm((f) => ({ ...f, description: e.target.value }))}
            />
          </DialogContent>
          <DialogActions className="!px-6 !pb-5">
            <Button color="inherit" onClick={() => setOpenCreateAlbum(false)} disabled={creatingAlbum}>
              Batal
            </Button>
            <Button type="submit" variant="contained" disabled={creatingAlbum}>
              {creatingAlbum ? 'Membuat...' : 'Buat Album'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog Edit Informasi & Banner Card Angkatan (Admin & Moderator) */}
      <EditAngkatanDialog
        open={openEditAngkatan}
        angkatan={angkatan}
        onClose={() => setOpenEditAngkatan(false)}
        onSuccess={(updated) => {
          setAngkatan(updated);
          fetchAngkatanData();
        }}
      />

      {/* Dialog Kelola & Hapus Album Angkatan */}
      <Dialog
        open={openManageAlbums}
        onClose={() => setOpenManageAlbums(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle className="font-bold flex items-center justify-between !pb-2">
          <div className="flex items-center gap-2">
            <FolderRoundedIcon className="text-pasim" />
            <span>Kelola Daftar Album Angkatan</span>
          </div>
          <Chip label={`${albums.length} Album`} size="small" />
        </DialogTitle>
        <DialogContent className="!pt-3 space-y-3">
          <Alert severity="info" className="!text-xs">
            Menghapus album <strong>tidak akan menghapus foto-foto</strong> di dalamnya. Foto akan tetap aman dan tampil di daftar &quot;Semua Foto&quot; angkatan ini.
          </Alert>

          {albums.length === 0 ? (
            <p className="text-muted text-center py-6 text-sm">Belum ada album di angkatan ini.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 rounded-xl overflow-hidden dark:border-slate-700">
              {albums.map((al) => (
                <div key={al.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 dark:text-white truncate">
                        {al.name}
                      </span>
                      <Chip label={`${al.photo_count || 0} foto`} size="small" className="!text-[10px]" />
                    </div>
                    {al.description && (
                      <p className="text-muted text-xs line-clamp-1 mb-0 mt-0.5">{al.description}</p>
                    )}
                  </div>

                  {canManageAlbum(al) ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditRoundedIcon />}
                        onClick={() => handleOpenEditAlbum(al)}
                        className="!text-xs !font-bold"
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onClick={() => setAlbumToDelete(al)}
                        className="!text-xs !font-bold"
                      >
                        Hapus
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted italic">Dibuat user lain</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions className="!px-6 !pb-4">
          <Button onClick={() => setOpenManageAlbums(false)}>Tutup</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Edit Nama Album (Admin & Moderator) */}
      <Dialog
        open={Boolean(editingAlbum)}
        onClose={() => !updatingAlbum && setEditingAlbum(null)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleSaveEditAlbum}>
          <DialogTitle className="font-bold flex items-center gap-2 !pb-2">
            <EditRoundedIcon className="text-pasim" />
            <span>Edit Nama & Info Album</span>
          </DialogTitle>
          <DialogContent className="!pt-3 space-y-3">
            <TextField
              fullWidth
              label="Nama Album"
              value={editAlbumForm.name}
              onChange={(e) => setEditAlbumForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Ospek & Makrab"
              required
              autoFocus
            />
            <TextField
              fullWidth
              label="Deskripsi Album (Opsional)"
              multiline
              minRows={2}
              value={editAlbumForm.description}
              onChange={(e) => setEditAlbumForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Keterangan singkat tentang album ini..."
            />
          </DialogContent>
          <DialogActions className="!px-6 !pb-4">
            <Button
              color="inherit"
              onClick={() => setEditingAlbum(null)}
              disabled={updatingAlbum}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={updatingAlbum}
              startIcon={updatingAlbum ? <CircularProgress size={16} color="inherit" /> : <EditRoundedIcon />}
            >
              {updatingAlbum ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Confirm Dialog Hapus Album */}
      <ConfirmDialog
        open={Boolean(albumToDelete)}
        title={`Hapus Album "${albumToDelete?.name}"?`}
        message={`Apakah Anda yakin ingin menghapus album "${albumToDelete?.name}"? Foto-foto di dalam album ini (${albumToDelete?.photo_count || 0} foto) TIDAK akan terhapus, melainkan tetap tersimpan di galeri angkatan.`}
        confirmText="Hapus Album"
        color="error"
        loading={deletingAlbum}
        onConfirm={handleDeleteAlbum}
        onClose={() => !deletingAlbum && setAlbumToDelete(null)}
      />
    </div>
  );
}
