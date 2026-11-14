// FILE: client/src/pages/academic/ClassMaterialsDetailPage.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Switch from '@mui/material/Switch';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import materialApi from '../../api/material.api';
import useAuthStore from '../../store/useAuthStore';
import { toast } from '../../store/useThemeStore';
import { ALLOWED_DOC_ACCEPT, formatBytes } from '../../utils/constants';
import YoutubePlayer from '../../components/academic/YoutubePlayer';
import PdfViewerModal from '../../components/academic/PdfViewerModal';

const MATERIAL_TYPE_LABELS = {
  silabus: 'Silabus / RPS',
  slide: 'Slide Presentasi (PDF)',
  rekaman: 'Rekaman Video (YouTube)',
  modul_praktikum: 'Modul Praktikum',
  lainnya: 'Dokumen Lainnya',
};

export default function ClassMaterialsDetailPage() {
  const { kelasId } = useParams();
  const user = useAuthStore((s) => s.user);

  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMeeting, setExpandedMeeting] = useState(1); // Default buka pertemuan 1

  // State Modal Tambah Materi
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedMeetingNumber, setSelectedMeetingNumber] = useState(1);
  const [materialForm, setMaterialForm] = useState({
    tipe: 'slide',
    judul: '',
    deskripsi: '',
    external_url: '',
    urutan: 1,
    is_published: true,
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  // State Pratinjau PDF
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState('');
  const [activePdfTitle, setActivePdfTitle] = useState('');

  // State Video Player yang aktif dibuka
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const isStudent = user?.role === 'mahasiswa';
  const isStaff = ['admin', 'moderator'].includes(user?.role);

  // Moderasi Materi (ACC / Tolak) oleh Admin & Moderator
  const handleModerateMaterial = async (itemId, status) => {
    let note = null;
    if (status === 'rejected') {
      note = window.prompt('Alasan penolakan materi (opsional):');
      if (note === null) return;
    }
    try {
      await materialApi.moderateMaterial(itemId, { status, note });
      toast.success(status === 'approved' ? 'Materi berhasil disetujui (ACC)!' : 'Materi ditolak.');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses moderasi materi.');
    }
  };

  const handleDownloadAllZip = async () => {
    try {
      setIsDownloadingZip(true);
      toast.info('Menyiapkan dan mengompres seluruh materi kelas (.ZIP)...');
      await materialApi.downloadClassZip(kelasId, classData?.mata_kuliah_nama || 'materi');
      toast.success('Berkas ZIP materi berhasil diunduh!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengunduh ZIP materi.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await materialApi.getClassMaterials(kelasId);
      setClassData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memuat materi kelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (kelasId) fetchData();
  }, [kelasId]);

  // Toggle progress belajar mahasiswa
  const handleToggleProgress = async (itemId) => {
    try {
      const res = await materialApi.toggleProgress(itemId);
      const isCompleted = res.data?.is_completed;

      // Update state secara optimis
      setClassData((prev) => {
        if (!prev) return prev;
        let newCompleted = prev.completed_materials || 0;
        if (isCompleted) newCompleted += 1;
        else newCompleted = Math.max(0, newCompleted - 1);

        const newPercentage =
          prev.total_materials > 0
            ? Math.round((newCompleted / prev.total_materials) * 100)
            : 0;

        const updatedMeetings = prev.meetings.map((m) => {
          return {
            ...m,
            items: m.items.map((item) => {
              if (item.id === itemId) {
                return { ...item, is_completed: isCompleted };
              }
              return item;
            }),
          };
        });

        return {
          ...prev,
          completed_materials: newCompleted,
          progress_percentage: newPercentage,
          meetings: updatedMeetings,
        };
      });

      if (isCompleted) toast.success('Materi ditandai sudah dipelajari!');
    } catch (err) {
      toast.error('Gagal memperbarui progres materi.');
    }
  };

  // Buka Modal Tambah Materi
  const handleOpenCreateModal = (meetingId, meetingNum) => {
    setSelectedMeetingId(meetingId);
    setSelectedMeetingNumber(meetingNum);
    setMaterialForm({
      tipe: 'slide',
      judul: '',
      deskripsi: '',
      external_url: '',
      urutan: 1,
      is_published: true,
    });
    setUploadedFile(null);
    setCreateModalOpen(true);
  };

  // Submit Tambah Materi
  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.judul.trim()) {
      toast.warning('Silakan masukkan judul materi.');
      return;
    }

    try {
      setSubmittingMaterial(true);
      const data = new FormData();
      data.append('pertemuan_id', selectedMeetingId);
      data.append('tipe', materialForm.tipe);
      data.append('judul', materialForm.judul);
      data.append('deskripsi', materialForm.deskripsi || '');
      data.append('urutan', materialForm.urutan);
      data.append('is_published', materialForm.is_published ? 1 : 0);

      if (materialForm.tipe === 'rekaman') {
        data.append('external_url', materialForm.external_url);
      } else if (uploadedFile) {
        data.append('file', uploadedFile);
      }

      const res = await materialApi.createMaterialItem(kelasId, data);
      toast.success(
        res?.message ||
        (isStaff
          ? `Materi berhasil ditambahkan ke Pertemuan ${selectedMeetingNumber}`
          : 'Materi berhasil diunggah! Berkas Anda akan ditinjau Admin/Moderator sebelum dipublikasikan.')
      );
      setCreateModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan materi.');
    } finally {
      setSubmittingMaterial(false);
    }
  };

  // Hapus Materi
  const handleDeleteMaterial = async (itemId, title) => {
    if (!window.confirm(`Hapus materi "${title}"?`)) return;

    try {
      await materialApi.deleteMaterialItem(itemId);
      toast.success('Materi berhasil dihapus.');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus materi.');
    }
  };

  // Pratinjau PDF
  const handlePreviewPdf = (url, title) => {
    setActivePdfUrl(url);
    setActivePdfTitle(title);
    setPdfModalOpen(true);
  };

  // Render Ikon Tipe Materi
  const renderTypeIcon = (type) => {
    switch (type) {
      case 'silabus':
        return <MenuBookRoundedIcon sx={{ fontSize: 18, color: 'info.main' }} />;
      case 'slide':
        return <PictureAsPdfRoundedIcon sx={{ fontSize: 18, color: 'error.main' }} />;
      case 'rekaman':
        return <YouTubeIcon sx={{ fontSize: 20, color: 'error.main' }} />;
      case 'modul_praktikum':
        return <CodeRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />;
      default:
        return <DescriptionRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />;
    }
  };

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rectangular" height={500} sx={{ mt: 4, borderRadius: 3 }} />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl px-4 py-16 text-center">
        <h2 className="text-xl font-bold">Kelas materi tidak ditemukan</h2>
        <Link to="/akademik/materi" className="mt-4 inline-block text-emerald-600 font-semibold underline">
          Kembali ke Repositori Materi
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/akademik/materi"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
          <span>Kembali ke Daftar Mata Kuliah</span>
        </Link>
      </div>

      {/* Header Info Kelas & Progress */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-navy-800 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <SchoolRoundedIcon sx={{ fontSize: 18 }} />
            <span>
              Kode: {classData.mata_kuliah_kode} • Koleksi Modul Perkuliahan
            </span>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {classData.semester_nama}
          </span>
        </div>

        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
            {classData.mata_kuliah_nama}
          </h1>

          <button
            onClick={handleDownloadAllZip}
            disabled={isDownloadingZip}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 shrink-0"
          >
            <FolderZipRoundedIcon sx={{ fontSize: 18 }} />
            <span>{isDownloadingZip ? 'Mengompres...' : 'Unduh Semua Materi (.ZIP)'}</span>
          </button>
        </div>

        {/* Progress Bar (Khusus Mahasiswa) */}
        {isStudent && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-200 dark:bg-navy dark:border-slate-700">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              <span className="flex items-center gap-1.5">
                <CheckCircleRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                Progres Pembelajaran Anda
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                {classData.progress_percentage || 0}% ({classData.completed_materials || 0}/{classData.total_materials || 0} Materi)
              </span>
            </div>
            <LinearProgress
              variant="determinate"
              value={classData.progress_percentage || 0}
              color="success"
              sx={{ borderRadius: 1.5, height: 8 }}
            />
          </div>
        )}
      </div>

      {/* Struktur Akordeon 16 Pertemuan */}
      <div className="mt-8 space-y-4">
        {classData.meetings?.map((meeting) => {
          const isUts = meeting.nomor_pertemuan === 8 || meeting.is_uts;
          const isUas = meeting.nomor_pertemuan === 16 || meeting.is_uas;
          const isExpanded = expandedMeeting === meeting.nomor_pertemuan;

          return (
            <Accordion
              key={meeting.id}
              expanded={isExpanded}
              onChange={() => setExpandedMeeting(isExpanded ? null : meeting.nomor_pertemuan)}
              className="!rounded-2xl border border-slate-200/90 !shadow-sm dark:border-slate-800 dark:bg-navy-800 before:hidden overflow-hidden"
            >
              <AccordionSummary
                expandIcon={<ExpandMoreRoundedIcon />}
                className="hover:bg-slate-50/60 dark:hover:bg-navy/40 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 w-full pr-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {meeting.nomor_pertemuan}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {meeting.judul}
                      </h3>
                      {meeting.deskripsi && (
                        <p className="text-xs text-slate-400 line-clamp-1">{meeting.deskripsi}</p>
                      )}
                    </div>
                  </div>

                  {/* Penanda Khusus UTS / UAS */}
                  <div className="flex items-center gap-2">
                    {isUts && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        ⭐ EVALUASI TENGAH SEMESTER (UTS)
                      </span>
                    )}
                    {isUas && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                        🏆 EVALUASI AKHIR SEMESTER (UAS)
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-400">
                      {meeting.items?.length || 0} Materi
                    </span>
                  </div>
                </div>
              </AccordionSummary>

              <AccordionDetails className="border-t border-slate-100 dark:border-slate-800 !p-5 bg-slate-50/40 dark:bg-navy/30">
                {/* Daftar Item Materi di Pertemuan Ini */}
                {meeting.items && meeting.items.length > 0 ? (
                  <div className="space-y-3">
                    {meeting.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-navy-800 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{renderTypeIcon(item.tipe)}</div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                  {item.judul}
                                </h4>
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  {MATERIAL_TYPE_LABELS[item.tipe] || item.tipe}
                                </span>
                                {item.status === 'pending' && (
                                  <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    ⏳ Menunggu ACC Moderator
                                  </span>
                                )}
                                {item.status === 'rejected' && (
                                  <span className="rounded bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                    ❌ Ditolak
                                  </span>
                                )}
                                {!item.is_published && (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    Draft
                                  </span>
                                )}
                              </div>
                              {item.uploader_name && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Dibagikan oleh:{' '}
                                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {item.uploader_name}
                                  </span>{' '}
                                  {item.uploader_role === 'alumni' ? '(Alumni)' : '(Mahasiswa)'}
                                </p>
                              )}
                              {item.deskripsi && (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {item.deskripsi}
                                </p>
                              )}
                              {item.status === 'rejected' && item.moderation_note && (
                                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 italic">
                                  Alasan penolakan: "{item.moderation_note}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Tombol Aksi Item */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {/* Tombol ACC / Tolak Moderasi (Khusus Admin & Moderator) */}
                            {isStaff && item.status === 'pending' && (
                              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-1 rounded-xl border border-amber-200 dark:border-amber-800">
                                <button
                                  onClick={() => handleModerateMaterial(item.id, 'approved')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                                  title="Setujui dan tayangkan materi ini"
                                >
                                  <CheckRoundedIcon sx={{ fontSize: 14 }} />
                                  <span>ACC</span>
                                </button>
                                <button
                                  onClick={() => handleModerateMaterial(item.id, 'rejected')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 transition"
                                  title="Tolak materi ini"
                                >
                                  <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                  <span>Tolak</span>
                                </button>
                              </div>
                            )}

                            {/* Checkbox Sudah Dipelajari (Mahasiswa) */}
                            {isStudent && item.status === 'approved' && (
                              <button
                                onClick={() => handleToggleProgress(item.id)}
                                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold transition border ${
                                  item.is_completed
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-navy dark:border-slate-700 dark:text-slate-300'
                                }`}
                                title="Tandai sudah dipelajari"
                              >
                                {item.is_completed ? (
                                  <CheckCircleRoundedIcon sx={{ fontSize: 15 }} />
                                ) : (
                                  <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 15 }} />
                                )}
                                <span>{item.is_completed ? 'Selesai' : 'Pelajari'}</span>
                              </button>
                            )}

                            {/* Tombol Putar Video YouTube */}
                            {item.tipe === 'rekaman' && (
                              <button
                                onClick={() =>
                                  setActiveVideoId(activeVideoId === item.id ? null : item.id)
                                }
                                className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 transition"
                              >
                                <PlayCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                <span>{activeVideoId === item.id ? 'Tutup Video' : 'Putar'}</span>
                              </button>
                            )}

                            {/* Tombol Pratinjau PDF */}
                            {item.url && item.file_format === 'pdf' && (
                              <button
                                onClick={() => handlePreviewPdf(item.url, item.judul)}
                                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 transition dark:bg-slate-700 dark:text-slate-200"
                              >
                                <VisibilityRoundedIcon sx={{ fontSize: 15 }} />
                                <span>Pratinjau</span>
                              </button>
                            )}

                            {/* Tombol Unduh Berkas Dokumen */}
                            {item.url && item.tipe !== 'rekaman' && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition"
                                title="Unduh Berkas"
                              >
                                <FileDownloadRoundedIcon sx={{ fontSize: 15 }} />
                                <span>Unduh</span>
                              </a>
                            )}

                            {/* Hapus Item (Pemilik materi atau Staff) */}
                            {(item.uploaded_by === user?.id || isStaff) && (
                              <button
                                onClick={() => handleDeleteMaterial(item.id, item.judul)}
                                className="p-1 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                                title="Hapus Materi"
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Embed Player jika Video Sedang Aktif */}
                        {item.tipe === 'rekaman' && activeVideoId === item.id && (
                          <div className="mt-3">
                            <YoutubePlayer
                              videoId={item.youtube_video_id}
                              videoUrl={item.url}
                              title={item.judul}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Belum ada materi pembelajaran yang diterbitkan pada pertemuan ini.
                  </p>
                )}

                {/* Tombol Bagikan Materi ke Pertemuan Ini */}
                {Boolean(user) && (
                  <button
                    onClick={() => handleOpenCreateModal(meeting.id, meeting.nomor_pertemuan)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-500/70 bg-emerald-50/50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-300 transition"
                  >
                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                    <span>Bagikan Materi ke Pertemuan {meeting.nomor_pertemuan}</span>
                  </button>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </div>

      {/* Modal Dialog: Bagikan Materi Pembelajaran (Mahasiswa, Alumni, Staff) */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ className: '!rounded-3xl' }}
      >
        <DialogTitle className="!font-bold !text-lg !pb-2">
          Bagikan Materi - Pertemuan {selectedMeetingNumber}
        </DialogTitle>
        <DialogContent dividers>
          {!isStaff && (
            <div className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 leading-relaxed">
              💡 <strong>Catatan Kurasi:</strong> Materi yang Anda bagikan akan ditinjau dan di-ACC oleh Admin/Moderator sebelum ditampilkan ke seluruh mahasiswa.
            </div>
          )}
          <form id="create-material-form" onSubmit={handleCreateMaterial} className="space-y-4 pt-1">
            {/* Tipe Materi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tipe Materi:
              </label>
              <TextField
                select
                fullWidth
                size="small"
                value={materialForm.tipe}
                onChange={(e) => setMaterialForm({ ...materialForm, tipe: e.target.value })}
              >
                <MenuItem value="slide">Slide Presentasi (PDF)</MenuItem>
                <MenuItem value="silabus">Silabus / RPS Kuliah</MenuItem>
                <MenuItem value="rekaman">Rekaman Video Perkuliahan (YouTube)</MenuItem>
                <MenuItem value="modul_praktikum">Modul Praktikum / Lab</MenuItem>
                <MenuItem value="lainnya">Dokumen / Berkas Lainnya</MenuItem>
              </TextField>
            </div>

            {/* Judul Materi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Materi:
              </label>
              <TextField
                fullWidth
                size="small"
                placeholder="Contoh: Slide 01 - Pengenalan Framework React & State Management"
                value={materialForm.judul}
                onChange={(e) => setMaterialForm({ ...materialForm, judul: e.target.value })}
                required
              />
            </div>

            {/* Deskripsi Singkat */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi Singkat (Opsional):
              </label>
              <textarea
                rows={2}
                placeholder="Penjelasan pokok bahasan atau panduan membaca materi..."
                value={materialForm.deskripsi}
                onChange={(e) => setMaterialForm({ ...materialForm, deskripsi: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-navy dark:text-slate-200"
              />
            </div>

            {/* Jika Tipe Rekaman: Input URL YouTube */}
            {materialForm.tipe === 'rekaman' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL Video YouTube:
                </label>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                  value={materialForm.external_url}
                  onChange={(e) => setMaterialForm({ ...materialForm, external_url: e.target.value })}
                  required
                />
              </div>
            ) : (
              /* Jika Tipe Berkas: Upload File */
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unggah Berkas Materi (PDF, ZIP, DOCX, XLSX, PPTX):
                </label>
                <input
                  type="file"
                  accept={ALLOWED_DOC_ACCEPT}
                  onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-500 file:mr-2 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300"
                />
                {uploadedFile && (
                  <span className="mt-1 block text-[11px] text-slate-500">
                    📄 {uploadedFile.name} ({formatBytes(uploadedFile.size)})
                  </span>
                )}
              </div>
            )}

            {/* Status Terbitkan */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200 dark:bg-navy dark:border-slate-700">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Langsung Terbitkan ke Mahasiswa
                </span>
                <p className="text-[10px] text-slate-400">
                  Jika dinonaktifkan, materi akan berstatus Draft dan tidak dapat dilihat mahasiswa.
                </p>
              </div>
              <Switch
                checked={materialForm.is_published}
                onChange={(e) =>
                  setMaterialForm({ ...materialForm, is_published: e.target.checked })
                }
                color="primary"
              />
            </div>
          </form>
        </DialogContent>
        <DialogActions className="!px-6 !py-4">
          <Button onClick={() => setCreateModalOpen(false)} color="inherit" size="small">
            Batal
          </Button>
          <Button
            type="submit"
            form="create-material-form"
            variant="contained"
            color="primary"
            disabled={submittingMaterial}
            size="small"
          >
            {submittingMaterial
              ? 'Mengunggah...'
              : isStaff
              ? 'Terbitkan Materi'
              : 'Kirim & Bagikan Materi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Pratinjau PDF */}
      <PdfViewerModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        fileUrl={activePdfUrl}
        title={activePdfTitle}
      />
    </div>
  );
}
