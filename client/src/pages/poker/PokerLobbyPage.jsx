// FILE: client/src/pages/poker/PokerLobbyPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import useAuthStore, { selectIsAdmin, selectIsStaff } from '../../store/useAuthStore';
import usePokerStore from '../../store/usePokerStore';
import { FEATURE_POKER_ENV_ENABLED, pokerApi } from '../../api/poker.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import PokerViewportShell from '../../components/poker/PokerViewportShell';
import ThemePicker from '../../components/poker/ThemePicker';
import {
  formatCompactChips,
  loadPokerPreferences,
  savePokerPreferences,
} from '../../utils/pokerUiHelpers';

const CHIP_PRESETS = [
  { value: 500, label: '500' },
  { value: 1000, label: '1K' },
  { value: 2000, label: '2K' },
];

const BLIND_PRESETS = [
  { value: '5/10', label: '5/10' },
  { value: '10/20', label: '10/20' },
  { value: '25/50', label: '25/50' },
];

const TIMER_PRESETS = [
  { value: 15, label: '15d' },
  { value: 30, label: '30d' },
  { value: 45, label: '45d' },
];

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

  const [preferences, setPreferences] = useState(() => loadPokerPreferences());
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  const [menuTab, setMenuTab] = useState('stats');

  const [createForm, setCreateForm] = useState({
    startingChips: 1000,
    blindLevel: '10/20',
    turnTimeoutSec: 30,
  });
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingFeature, setTogglingFeature] = useState(false);

  useEffect(() => {
    if (!FEATURE_POKER_ENV_ENABLED) return;
    fetchLobbyStatus().catch(() => {});
  }, [fetchLobbyStatus]);

  const updatePreferences = (partial) => {
    const next = savePokerPreferences({ ...preferences, ...partial });
    setPreferences(next);
  };

  const handleCreateRoom = async (quickBotMode = false) => {
    setSubmitting(true);
    try {
      const state = await createRoom({ ...createForm, quickBotMode });
      setCreateSheetOpen(false);
      navigate(`/poker/${state.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Gagal membuat room.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      toast.error('Masukkan kode room 6 karakter.');
      return;
    }
    setSubmitting(true);
    try {
      const state = await joinRoom(cleaned);
      setJoinSheetOpen(false);
      navigate(`/poker/${state.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Gagal bergabung ke room.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof window !== 'undefined' && window.navigator?.clipboard?.readText) {
        const text = await window.navigator.clipboard.readText();
        const cleaned = String(text || '')
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase()
          .slice(0, 6);
        if (cleaned) {
          setJoinCode(cleaned);
          return;
        }
      }
      toast.info('Tempel kode secara manual pada kolom input.');
    } catch (_err) {
      toast.info('Izin clipboard tidak tersedia, ketik kode 6 karakter.');
    }
  };

  const handleAdminToggleFeature = async (checked) => {
    setTogglingFeature(true);
    try {
      const res = await pokerApi.adminToggleFeature(checked);
      toast.success(res.message);
      await fetchLobbyStatus();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengubah status fitur.'));
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
      <PokerViewportShell theme={preferences.tableTheme}>
        <div className="m-auto w-full max-w-sm poker-flat-panel p-5 text-center space-y-4">
          <h1 className="m-0 poker-text-md font-bold">Fitur Sedang Nonaktif</h1>
          <p className="m-0 poker-text-sm text-slate-400">
            Permainan sedang dinonaktifkan sementara oleh pengelola portal.
          </p>
          <Button
            component={Link}
            to="/"
            variant="outlined"
            color="inherit"
            fullWidth
            className="!min-h-[46px] !rounded-xl !border-slate-600 !text-slate-100"
          >
            Kembali ke Portal
          </Button>
        </div>
      </PokerViewportShell>
    );
  }

  const stats = lobbyData?.myStats || { total_played: 0, total_wins: 0, recent_matches: [] };

  return (
    <PokerViewportShell theme={preferences.tableTheme}>
      {/* Bar Atas Tipis: Kembali (Kiri), Judul Kecil (Tengah), Satu Ikon Menu (Kanan) */}
      <header className="flex items-center justify-between px-1">
        <IconButton
          component={Link}
          to="/"
          aria-label="Kembali ke beranda portal"
          className="!min-h-[44px] !min-w-[44px] !text-slate-200"
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>

        <h1 className="m-0 poker-text-md font-extrabold tracking-tight text-slate-100">
          Poker Kampus
        </h1>

        <IconButton
          onClick={() => setMenuSheetOpen(true)}
          aria-label="Buka menu statistik, aturan, dan pengaturan"
          className="!min-h-[44px] !min-w-[44px] !text-slate-200"
        >
          <MenuRoundedIcon fontSize="small" />
        </IconButton>
      </header>

      {/* Area Tengah Lega: Hanya Dua Tombol Besar ("Buat Room" dan "Gabung") */}
      <div className="my-auto mx-auto w-full max-w-xs px-3 flex flex-col gap-3">
        <Button
          variant="contained"
          color="success"
          disabled={!featureEnabled || submitting}
          onClick={() => setCreateSheetOpen(true)}
          className="!min-h-[54px] !rounded-2xl !bg-emerald-600 hover:!bg-emerald-500 !text-white !font-extrabold poker-text-md !normal-case !shadow-none"
        >
          Buat Room
        </Button>

        <Button
          variant="outlined"
          color="inherit"
          disabled={!featureEnabled || submitting}
          onClick={() => setJoinSheetOpen(true)}
          className="!min-h-[54px] !rounded-2xl !border-slate-600 !bg-slate-900/60 hover:!bg-slate-800 !text-slate-100 !font-extrabold poker-text-md !normal-case"
        >
          Gabung
        </Button>
      </div>

      {/* Disclaimer Satu Baris di Bawah */}
      <footer className="py-1 text-center">
        <p className="m-0 poker-text-sm text-slate-400 truncate">
          Chip virtual, tanpa uang asli
        </p>
      </footer>

      {/* SHEET 1: Buat Room (Pilihan Preset Ringkas Tanpa Form Panjang) */}
      <Drawer
        anchor="bottom"
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        PaperProps={{
          className:
            '!mx-auto !w-full !max-w-md !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100',
        }}
      >
        <div className="p-4 space-y-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="poker-text-md font-extrabold">Buat Room</span>
            <IconButton
              onClick={() => setCreateSheetOpen(false)}
              aria-label="Tutup sheet buat room"
              className="!min-h-[44px] !min-w-[44px] !text-slate-300"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          {/* Preset Chip Awal */}
          <div className="space-y-1">
            <span className="poker-text-sm font-semibold text-slate-400">Chip Awal</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pilih chip awal">
              {CHIP_PRESETS.map((opt) => {
                const active = createForm.startingChips === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCreateForm({ ...createForm, startingChips: opt.value })}
                    className={`min-h-[44px] rounded-xl border poker-text-md font-bold poker-tabular transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-700 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Blind / Tarif */}
          <div className="space-y-1">
            <span className="poker-text-sm font-semibold text-slate-400">Blind / Tarif</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pilih blind">
              {BLIND_PRESETS.map((opt) => {
                const active = createForm.blindLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCreateForm({ ...createForm, blindLevel: opt.value })}
                    className={`min-h-[44px] rounded-xl border poker-text-md font-bold poker-tabular transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-700 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Timer Giliran */}
          <div className="space-y-1">
            <span className="poker-text-sm font-semibold text-slate-400">Timer Giliran</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pilih timer giliran">
              {TIMER_PRESETS.map((opt) => {
                const active = createForm.turnTimeoutSec === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCreateForm({ ...createForm, turnTimeoutSec: opt.value })}
                    className={`min-h-[44px] rounded-xl border poker-text-md font-bold poker-tabular transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-700 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outlined"
              color="inherit"
              disabled={submitting}
              onClick={() => handleCreateRoom(true)}
              className="!min-h-[48px] !rounded-xl !border-slate-600 !text-slate-100 !font-bold poker-text-sm !normal-case"
            >
              Lawan Bot
            </Button>
            <Button
              variant="contained"
              color="success"
              disabled={submitting}
              onClick={() => handleCreateRoom(false)}
              className="!min-h-[48px] !rounded-xl !bg-emerald-600 !text-white !font-extrabold poker-text-sm !normal-case !shadow-none"
            >
              {submitting ? 'Membuat…' : 'Buka Room'}
            </Button>
          </div>

          {lobbyData?.activeRoomId && (
            <Button
              component={Link}
              to={`/poker/${lobbyData.activeRoomId}`}
              variant="text"
              color="warning"
              fullWidth
              className="!min-h-[44px] !font-bold poker-text-sm !normal-case"
            >
              Lanjutkan Room Aktif #{lobbyData.activeRoomId}
            </Button>
          )}
        </div>
      </Drawer>

      {/* SHEET 2: Gabung Room (Satu Input 6 Karakter + Tempel Clipboard + Satu Tombol) */}
      <Drawer
        anchor="bottom"
        open={joinSheetOpen}
        onClose={() => setJoinSheetOpen(false)}
        PaperProps={{
          className:
            '!mx-auto !w-full !max-w-md !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100',
        }}
      >
        <form
          onSubmit={handleJoinSubmit}
          className="p-4 space-y-3.5"
          style={{
            paddingBottom:
              'calc(1rem + var(--poker-keyboard-inset, 0px) + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="poker-text-md font-extrabold">Gabung Room</span>
            <IconButton
              onClick={() => setJoinSheetOpen(false)}
              aria-label="Tutup sheet gabung room"
              className="!min-h-[44px] !min-w-[44px] !text-slate-300"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={joinCode}
              onChange={(e) =>
                setJoinCode(
                  e.target.value
                    .replace(/[^A-Za-z0-9]/g, '')
                    .toUpperCase()
                    .slice(0, 6)
                )
              }
              placeholder="KODE 6 DIGIT"
              aria-label="Kode ID Room 6 karakter"
              className="min-h-[48px] flex-1 rounded-xl border border-slate-600 bg-slate-900 px-3 text-center font-mono poker-text-lg font-extrabold tracking-widest text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
            <IconButton
              onClick={handlePasteClipboard}
              aria-label="Tempel kode dari clipboard"
              className="!min-h-[48px] !min-w-[48px] !rounded-xl !border !border-slate-600 !bg-slate-800 !text-slate-200"
            >
              <ContentPasteRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <Button
            type="submit"
            variant="contained"
            color="success"
            fullWidth
            disabled={submitting || joinCode.trim().length < 4}
            className="!min-h-[48px] !rounded-xl !bg-emerald-600 !text-white !font-extrabold poker-text-md !normal-case !shadow-none"
          >
            {submitting ? 'Menyambungkan…' : 'Masuk ke Meja'}
          </Button>
        </form>
      </Drawer>

      {/* SHEET 3: Menu Sekunder Tunggal (Statistik, Aturan, Pengaturan, & Admin) */}
      <Drawer
        anchor="bottom"
        open={menuSheetOpen}
        onClose={() => setMenuSheetOpen(false)}
        PaperProps={{
          className:
            '!mx-auto !w-full !max-w-lg !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100 !max-h-[82dvh]',
        }}
      >
        <div className="p-4 space-y-3 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="poker-text-md font-extrabold">Menu Poker</span>
            <IconButton
              onClick={() => setMenuSheetOpen(false)}
              aria-label="Tutup menu poker"
              className="!min-h-[44px] !min-w-[44px] !text-slate-300"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <div className="grid grid-cols-3 gap-1.5" role="tablist">
            {[
              { id: 'stats', label: 'Statistik' },
              { id: 'rules', label: 'Aturan' },
              { id: 'settings', label: 'Pengaturan' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={menuTab === tab.id}
                onClick={() => setMenuTab(tab.id)}
                className={`min-h-[44px] rounded-xl border poker-text-sm font-bold transition ${
                  menuTab === tab.id
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {menuTab === 'stats' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="poker-flat-elevated p-3 text-center">
                  <div className="poker-text-sm text-slate-400">Total Main</div>
                  <div className="poker-text-lg font-extrabold text-white">
                    {stats.total_played || 0}
                  </div>
                </div>
                <div className="poker-flat-elevated p-3 text-center">
                  <div className="poker-text-sm text-slate-400">Menang Meja</div>
                  <div className="poker-text-lg font-extrabold text-emerald-400">
                    {stats.total_wins || 0}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="poker-flat-elevated p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="poker-text-sm font-bold text-white">Status Fitur (Admin)</div>
                    <div className="poker-text-sm text-slate-400">
                      Matikan atau aktifkan fitur tanpa redeploy
                    </div>
                  </div>
                  <Switch
                    color="success"
                    checked={Boolean(featureEnabled)}
                    disabled={togglingFeature}
                    onChange={(e) => handleAdminToggleFeature(e.target.checked)}
                    inputProps={{ 'aria-label': 'Status fitur poker' }}
                  />
                </div>
              )}

              {isStaff && lobbyData?.adminRooms?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="poker-text-sm font-bold text-slate-300">
                    Room Aktif ({lobbyData.adminRooms.length})
                  </div>
                  {lobbyData.adminRooms.slice(0, 4).map((rm) => (
                    <div
                      key={rm.roomId}
                      className="poker-flat-elevated px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="poker-text-sm font-mono font-bold">
                        #{rm.roomId} · {rm.playerCount}p
                      </span>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleForceCloseRoom(rm.roomId)}
                        className="!min-h-[44px] poker-text-sm"
                      >
                        Tutup
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {menuTab === 'rules' && (
            <div className="poker-flat-elevated p-3.5 space-y-2 poker-text-sm text-slate-200">
              <div>
                <strong>Peringkat Tangan (Tinggi ke Rendah):</strong>
              </div>
              <ol className="m-0 pl-4 space-y-1">
                <li>Royal / Straight Flush (5 kartu berurutan satu kembang)</li>
                <li>Four of a Kind / Bom (4 kartu angka sama + 1 kartu)</li>
                <li>Full House / Polo (3 kartu sama + Pair)</li>
                <li>Flush / Warna (5 kartu satu kembang)</li>
                <li>Straight / Seri (5 kartu angka berurutan)</li>
                <li>Three of a Kind, One Pair (Pair), High Card (Single)</li>
              </ol>
              <div className="pt-1 text-slate-400">
                Chip awal tiap room ({formatCompactChips(createForm.startingChips)}) bersifat virtual dan di-reset saat room berakhir.
              </div>
            </div>
          )}

          {menuTab === 'settings' && (
            <ThemePicker
              tableTheme={preferences.tableTheme}
              cardBack={preferences.cardBack}
              fourColorDeck={preferences.fourColorDeck}
              onChangeTheme={(tableTheme) => updatePreferences({ tableTheme })}
              onChangeCardBack={(cardBack) => updatePreferences({ cardBack })}
              onChangeFourColorDeck={(fourColorDeck) => updatePreferences({ fourColorDeck })}
            />
          )}
        </div>
      </Drawer>
    </PokerViewportShell>
  );
}
