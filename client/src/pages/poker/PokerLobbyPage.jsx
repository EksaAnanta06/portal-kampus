// FILE: client/src/pages/poker/PokerLobbyPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import useAuthStore, { selectIsAdmin, selectIsStaff } from '../../store/useAuthStore';
import usePokerStore from '../../store/usePokerStore';
import { FEATURE_POKER_ENV_ENABLED, pokerApi } from '../../api/poker.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';

export default function PokerLobbyPage() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(selectIsAdmin);
  const isStaff = useAuthStore(selectIsStaff);

  const {
    featureEnabled,
    statusLoading,
    lobbyData,
    fetchLobbyStatus,
    createRoom,
    joinRoom,
  } = usePokerStore();

  const [createForm, setCreateForm] = useState({
    startingChips: 1000,
    blindLevel: '10/20',
    turnTimeoutSec: 30,
  });
  const [joinCode, setJoinCode] = useState('');
  const [submittingBot, setSubmittingBot] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [togglingFeature, setTogglingFeature] = useState(false);

  useEffect(() => {
    if (!FEATURE_POKER_ENV_ENABLED) return;
    fetchLobbyStatus().catch(() => {});
  }, [fetchLobbyStatus]);

  const handlePlayVsBot = async () => {
    setSubmittingBot(true);
    try {
      const state = await createRoom({ ...createForm, quickBotMode: true });
      toast.success(`Meja Capsa Banting ${state.roomId} siap! Melawan 3 Bot.`);
      navigate(`/poker/${state.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Gagal memulai permainan lawan Bot.');
    } finally {
      setSubmittingBot(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    try {
      const state = await createRoom({ ...createForm, quickBotMode: false });
      toast.success(`Room ${state.roomId} dibuat.`);
      navigate(`/poker/${state.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Gagal membuat room.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      toast.error('Masukkan kode ID room 6 karakter yang valid.');
      return;
    }
    setSubmittingJoin(true);
    try {
      const state = await joinRoom(cleaned);
      navigate(`/poker/${state.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Gagal bergabung ke room.');
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleAdminToggleFeature = async (checked) => {
    setTogglingFeature(true);
    try {
      const res = await pokerApi.adminToggleFeature(checked);
      toast.success(res.message);
      await fetchLobbyStatus();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengubah status fitur Capsa Banting.'));
    } finally {
      setTogglingFeature(false);
    }
  };

  const handleForceCloseRoom = async (roomId) => {
    try {
      const res = await pokerApi.adminCloseRoom(roomId);
      toast.success(res.message);
      await fetchLobbyStatus();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal menutup room.'));
    }
  };

  if (!FEATURE_POKER_ENV_ENABLED || (!statusLoading && !featureEnabled && !isAdmin)) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <div className="card-surface p-6 text-center space-y-3">
          <CasinoRoundedIcon sx={{ fontSize: 44 }} className="text-slate-400 mx-auto" />
          <h1 className="m-0 text-xl font-extrabold text-slate-900 dark:text-white">
            Capsa Banting Tidak Tersedia
          </h1>
          <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
            Fitur Poker Capsa Banting sedang dinonaktifkan sementara oleh pengelola portal.
          </p>
          <Button component={Link} to="/" variant="outlined" className="!min-h-[44px]">
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    );
  }

  const stats = lobbyData?.myStats || { total_played: 0, total_wins: 0, recent_matches: [] };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Banner Header Hijau Tenang */}
      <section className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-5 sm:p-7 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              <CasinoRoundedIcon sx={{ fontSize: 14 }} />
              Hiburan Mahasiswa · Capsa Banting (Big 2)
            </span>
            <h1 className="m-0 text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
              Poker Capsa Banting Virtual
            </h1>
            <p className="m-0 text-xs sm:text-sm text-emerald-100">
              Aturan Big 2 klasik: 4 pemain × 13 kartu, kartu <strong>2♠</strong> tertinggi &amp; pembukaan wajib <strong>3♦</strong>. Main cepat lawan Bot atau mabar lewat ID room!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {lobbyData?.activeRoomId ? (
              <Button
                component={Link}
                to={`/poker/${lobbyData.activeRoomId}`}
                variant="contained"
                className="!min-h-[44px] !rounded-xl !bg-white !font-bold !text-emerald-800 hover:!bg-emerald-50"
              >
                Lanjutkan Room #{lobbyData.activeRoomId}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<SmartToyRoundedIcon />}
                disabled={submittingBot || !featureEnabled}
                onClick={handlePlayVsBot}
                className="!min-h-[46px] !rounded-xl !bg-white !px-5 !font-black !text-emerald-800 hover:!bg-emerald-50 shadow-lg"
              >
                {submittingBot ? 'Menyiapkan Meja...' : 'Main vs 3 Bot (Big 2)'}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Disclaimer Wajib */}
      <Alert severity="info" className="!rounded-2xl !text-xs sm:!text-sm">
        <strong>Game hiburan dengan chip virtual. Tidak ada uang asli.</strong> Tidak ada top-up, penarikan, atau saldo permanen antar room — seluruh chip otomatis habis saat room selesai.
      </Alert>

      {/* Kontrol Runtime Admin */}
      {isAdmin && (
        <div className="card-surface p-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-amber-500">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Kontrol Admin Fitur Capsa Banting
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Matikan kapan saja tanpa redeploy. Room aktif otomatis ditutup dengan pemberitahuan sopan.
            </div>
          </div>
          <FormControlLabel
            control={
              <Switch
                color="success"
                checked={Boolean(featureEnabled)}
                disabled={togglingFeature}
                onChange={(e) => handleAdminToggleFeature(e.target.checked)}
              />
            }
            label={<span className="text-sm font-bold">{featureEnabled ? 'Aktif' : 'Mati'}</span>}
          />
        </div>
      )}

      {/* Grid Buat Room Privat & Gabung Room */}
      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={handleCreate} className="card-surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AddCircleOutlineRoundedIcon className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="m-0 text-base font-extrabold text-slate-900 dark:text-white">
              Buat Room Mabar (Privat)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextField
              select
              label="Chip Awal"
              value={createForm.startingChips}
              onChange={(e) => setCreateForm({ ...createForm, startingChips: Number(e.target.value) })}
            >
              <MenuItem value={500}>500 Chip</MenuItem>
              <MenuItem value={1000}>1.000 Chip</MenuItem>
              <MenuItem value={2000}>2.000 Chip</MenuItem>
            </TextField>

            <TextField
              select
              label="Taruhan / Kartu"
              value={createForm.blindLevel}
              onChange={(e) => setCreateForm({ ...createForm, blindLevel: e.target.value })}
            >
              <MenuItem value="5/10">5 Chip / Kartu</MenuItem>
              <MenuItem value="10/20">10 Chip / Kartu</MenuItem>
              <MenuItem value="25/50">25 Chip / Kartu</MenuItem>
            </TextField>

            <TextField
              select
              label="Timer Giliran"
              value={createForm.turnTimeoutSec}
              onChange={(e) => setCreateForm({ ...createForm, turnTimeoutSec: Number(e.target.value) })}
            >
              <MenuItem value={15}>15 Detik</MenuItem>
              <MenuItem value={30}>30 Detik</MenuItem>
              <MenuItem value={45}>45 Detik</MenuItem>
            </TextField>
          </div>

          <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
            Jika teman yang masuk kurang dari 4 orang, kursi kosong otomatis diisi Bot AI saat dimulai.
          </p>

          <Button
            type="submit"
            variant="contained"
            color="success"
            fullWidth
            disabled={submittingCreate || !featureEnabled}
            className="!min-h-[46px] !font-bold"
          >
            {submittingCreate ? 'Membuat Room...' : 'Buat Room Mabar'}
          </Button>
        </form>

        <form onSubmit={handleJoin} className="card-surface p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LoginRoundedIcon className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="m-0 text-base font-extrabold text-slate-900 dark:text-white">
                Gabung Lewat ID Room
              </h2>
            </div>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              Masukkan 6 karakter kode room dari teman (tidak peka huruf besar/kecil).
            </p>
            <TextField
              label="ID Room (contoh: A7K9P2)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 8, style: { letterSpacing: '0.18em', fontWeight: 800 } }}
              placeholder="XXXXXX"
            />
          </div>

          <Button
            type="submit"
            variant="outlined"
            color="success"
            fullWidth
            disabled={submittingJoin || !featureEnabled}
            className="!min-h-[46px] !font-bold"
          >
            {submittingJoin ? 'Menyambungkan...' : 'Masuk ke Meja'}
          </Button>
        </form>
      </div>

      {/* Ringkasan Aturan Singkat Capsa Banting + Statistik */}
      <div className="card-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <EmojiEventsRoundedIcon className="text-amber-500" />
            <h2 className="m-0 text-base font-extrabold text-slate-900 dark:text-white">
              Statistik Hiburan Saya
            </h2>
          </div>

          {statusLoading ? (
            <Skeleton width={160} height={28} />
          ) : (
            <div className="flex items-center gap-2">
              <Chip size="small" label={`Total Main: ${stats.total_played}x`} />
              <Chip size="small" color="success" label={`Menang Meja: ${stats.total_wins}x`} />
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy dark:text-slate-300 space-y-1">
          <div>
            <strong>Urutan Angka:</strong> 3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; <strong>2</strong> &nbsp;|&nbsp; <strong>Urutan Kembang:</strong> ♦ &lt; ♣ &lt; ♥ &lt; ♠
          </div>
          <div>
            <strong>Kombinasi 5 Kartu:</strong> Straight (Seri) &lt; Flush (Warna) &lt; Full House (Polo) &lt; Four of a Kind (Bom) &lt; Straight Flush (Bom Utama). Bom bisa memotong kartu <strong>2</strong>!
          </div>
        </div>

        {!statusLoading && stats.recent_matches?.length === 0 ? (
          <p className="m-0 text-xs text-slate-400">
            Belum ada riwayat permainan selesai. Tekan &quot;Main vs 3 Bot (Big 2)&quot; untuk langsung bermain!
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(stats.recent_matches || []).map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 p-3 text-xs space-y-1 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                    #{m.room_id}
                  </span>
                  <Chip
                    size="small"
                    color={m.is_winner ? 'success' : 'default'}
                    label={m.is_winner ? 'Juara' : 'Selesai'}
                    className="!h-5 !text-[10px]"
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {m.player_count} pemain · {m.jumlah_tangan} ronde
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daftar Room Aktif untuk Staff */}
      {isStaff && lobbyData?.adminRooms?.length > 0 && (
        <div className="card-surface p-5 space-y-3">
          <h3 className="m-0 text-sm font-extrabold text-slate-900 dark:text-white">
            Moderasi: Room Aktif ({lobbyData.adminRooms.length})
          </h3>
          <div className="space-y-2">
            {lobbyData.adminRooms.map((rm) => (
              <div
                key={rm.roomId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">#{rm.roomId}</span>
                  <span className="ml-2 text-slate-500">
                    Fase: {rm.phase} · {rm.playerCount} kursi · Ronde #{rm.handNumber}
                  </span>
                </div>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<CloseRoundedIcon />}
                  onClick={() => handleForceCloseRoom(rm.roomId)}
                  className="!min-h-[36px]"
                >
                  Tutup Paksa
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
