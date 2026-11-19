// FILE: client/src/components/poker/PokerTableView.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import PokerViewportShell from './PokerViewportShell';
import PokerTable from './PokerTable';
import ActionPanel from './ActionPanel';
import LandscapeCapsaTable from './LandscapeCapsaTable';
import FlyingTableOverlay from './FlyingTableOverlay';
import ThemePicker from './ThemePicker';
import ConfirmDialog from '../common/ConfirmDialog';
import useAnimationQueue from '../../hooks/useAnimationQueue';
import useSfx from '../../hooks/useSfx';
import useHandOrdering from '../../hooks/useHandOrdering';
import { useFullscreen } from '../../utils/useFullscreen';
import {
  computeViewportLayoutMode,
  formatAriaLiveAnnouncement,
  formatCompactChips,
  loadPokerPreferences,
  savePokerPreferences,
  mapSeatsRelativeToViewer,
} from '../../utils/pokerUiHelpers';
import { pokerApi } from '../../api/poker.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';

const RANK_POWER = {
  3: 0,
  4: 1,
  5: 2,
  6: 3,
  7: 4,
  8: 5,
  9: 6,
  10: 7,
  11: 8,
  12: 9,
  13: 10,
  14: 11,
  2: 12,
};
const SUIT_POWER = { D: 0, C: 1, H: 2, S: 3 };

const readViewportMetrics = () => {
  if (typeof window === 'undefined') {
    return { layoutMode: 'desktop', ultraCompact: false };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    layoutMode: computeViewportLayoutMode(w, h),
    ultraCompact: Math.min(w, h) <= 340,
  };
};

export default function PokerTableView({
  roomState,
  currentUserId,
  currentUserRole,
  socketStatus = 'connected',
  serverClockOffsetMs = 0,
  actionLog = [],
  fourColorDeck,
  soundEnabled,
  actionBusy = false,
  onToggleFourColor,
  onToggleSound,
  onGameAction,
  onLeaveRoom,
  onEndRoom,
}) {
  const [preferences, setPreferences] = useState(() => loadPokerPreferences());
  const [metrics, setMetrics] = useState(readViewportMetrics);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState('log');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    reportedUserId: '',
    reason: 'harassment',
    description: '',
  });
  const [reporting, setReporting] = useState(false);

  const [selectedCodes, setSelectedCodes] = useState([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [sortMode, setSortMode] = useState('rank');
  const [tableMode, setTableMode] = useState('capsa');
  const [holdemBet, setHoldemBet] = useState(40);

  const animQueue = useAnimationQueue();
  const sfx = useSfx(preferences);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setMetrics(readViewportMetrics());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updatePreferences = (nextPartial) => {
    const merged = savePokerPreferences({
      ...preferences,
      ...nextPartial,
    });
    setPreferences(merged);

    if (
      nextPartial.fourColorDeck !== undefined &&
      Boolean(nextPartial.fourColorDeck) !== Boolean(fourColorDeck)
    ) {
      onToggleFourColor?.();
    }
    if (
      nextPartial.sfxEnabled !== undefined &&
      Boolean(nextPartial.sfxEnabled) !== Boolean(soundEnabled)
    ) {
      onToggleSound?.();
    }
  };

  const { roomId, room, table, viewerSeat, myHoleCards, validActions } = roomState;
  const seats = table?.seats || [];
  const isHost = room?.hostUserId === currentUserId;
  const isStaff = ['admin', 'moderator'].includes(currentUserRole);
  const reportableHumans = seats.filter((s) => s.userId !== currentUserId && !s.isBot);

  const sortedMyCards = useMemo(() => {
    const raw = [...(myHoleCards || [])];
    if (sortMode === 'suit') {
      return raw.sort((a, b) => {
        const sa = SUIT_POWER[a.suit] ?? 0;
        const sb = SUIT_POWER[b.suit] ?? 0;
        if (sa !== sb) return sa - sb;
        return (RANK_POWER[a.rank] ?? 0) - (RANK_POWER[b.rank] ?? 0);
      });
    }
    return raw.sort((a, b) => {
      const ra = RANK_POWER[a.rank] ?? 0;
      const rb = RANK_POWER[b.rank] ?? 0;
      if (ra !== rb) return ra - rb;
      return (SUIT_POWER[a.suit] ?? 0) - (SUIT_POWER[b.suit] ?? 0);
    });
  }, [myHoleCards, sortMode]);

  useEffect(() => {
    const owned = new Set((myHoleCards || []).map((c) => c.code));
    setSelectedCodes((prev) => prev.filter((code) => owned.has(code)));
    setHintIndex(0);
  }, [myHoleCards, room?.handNumber, table?.currentTurnSeat]);

  const activeTurnSeatObj = seats.find((s) => s.seatIndex === table?.currentTurnSeat);
  const isMyTurn = viewerSeat !== null && table?.currentTurnSeat === viewerSeat;

  const handOrder = useHandOrdering(
    tableMode === 'holdem' ? sortedMyCards.slice(0, 2) : sortedMyCards,
    sfx
  );

  // Animasi singkat (<= 220ms) saat ronde baru
  const prevHandNumberRef = useRef(room?.handNumber);
  useEffect(() => {
    if (room?.handNumber && room.handNumber !== prevHandNumberRef.current) {
      prevHandNumberRef.current = room.handNumber;
      animQueue.enqueueSteps([{ type: 'deal', durationMs: 220 }], { replaceStale: true });
      sfx.playDeal();
    }
  }, [room?.handNumber, animQueue, sfx]);

  // Animasi singkat (<= 200ms) saat kartu tengah berubah
  const prevPlayKeyRef = useRef('');
  useEffect(() => {
    const playKey = table?.currentPlay
      ? `${table.currentPlay.seatIndex}-${(table.currentPlay.cards || []).map((c) => c.code).join(',')}`
      : '';
    if (playKey && playKey !== prevPlayKeyRef.current) {
      prevPlayKeyRef.current = playKey;
      animQueue.enqueueSteps([{ type: 'community_flip', durationMs: 200 }], { replaceStale: true });
      sfx.playFlip();
    } else if (!playKey) {
      prevPlayKeyRef.current = '';
    }
  }, [table?.currentPlay, animQueue, sfx]);

  // Suara & getaran saat giliran tiba
  const prevIsMyTurnRef = useRef(isMyTurn);
  useEffect(() => {
    const wasMyTurn = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = isMyTurn;
    if (!wasMyTurn && isMyTurn) {
      sfx.playTurn();
      sfx.triggerTurnHaptic(28);
    }
  }, [isMyTurn, sfx]);

  const relSeats = useMemo(
    () => mapSeatsRelativeToViewer(seats, viewerSeat ?? 0, 4),
    [seats, viewerSeat]
  );

  // Animasi selebrasi & lemparan pot chip saat ronde dimenangkan
  const prevLastHandResultRef = useRef(null);
  useEffect(() => {
    const res = table?.lastHandResult;
    if (res && res !== prevLastHandResultRef.current) {
      prevLastHandResultRef.current = res;
      const winnerSeat = res.winnerSeat;
      let winnerSlot = 'bottom';
      if (winnerSeat !== undefined && winnerSeat !== null) {
        if (winnerSeat === relSeats.top?.seatIndex) winnerSlot = 'top';
        else if (winnerSeat === relSeats.left?.seatIndex) winnerSlot = 'left';
        else if (winnerSeat === relSeats.right?.seatIndex) winnerSlot = 'right';
      }
      animQueue.enqueueSteps([
        {
          type: 'pot_to_winner',
          durationMs: 700,
          payload: {
            winnerSlot,
            totalWon: res.totalWon || (room?.config?.baseStake || 10) * 3,
          },
        },
      ]);
      sfx.playWin();
      sfx.triggerTurnHaptic(40);
    }
  }, [table?.lastHandResult, relSeats, room?.config?.baseStake, animQueue, sfx]);

  const liveAnnouncement = useMemo(
    () =>
      formatAriaLiveAnnouncement({
        lastHandResult: table?.lastHandResult,
        currentPlay: table?.currentPlay,
        isMyTurn,
        activeTurnName: activeTurnSeatObj?.fullName || '',
        mustIncludeThreeDiamond: Boolean(table?.mustIncludeThreeDiamond),
      }),
    [
      table?.lastHandResult,
      table?.currentPlay,
      isMyTurn,
      activeTurnSeatObj?.fullName,
      table?.mustIncludeThreeDiamond,
    ]
  );

  const handleToggleCard = (code) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handlePlaySelected = async () => {
    if (selectedCodes.length === 0) return;
    try {
      await onGameAction({
        roomId,
        handNumber: room.handNumber,
        turnToken: table.turnToken,
        action: 'play',
        cards: selectedCodes,
      });
      setSelectedCodes([]);
    } catch (err) {
      toast.error(err.message || 'Kombinasi kartu belum sah.');
    }
  };

  const handlePass = async () => {
    try {
      await onGameAction({
        roomId,
        handNumber: room.handNumber,
        turnToken: table.turnToken,
        action: 'pass',
      });
      setSelectedCodes([]);
    } catch (err) {
      toast.error(err.message || 'Gagal melewati giliran.');
    }
  };

  const handleHint = () => {
    const hints = validActions?.suggestedMoves || [];
    if (hints.length === 0) {
      toast.info('Tidak ada kombinasi yang bisa membanting kartu meja.');
      return;
    }
    const chosen = hints[hintIndex % hints.length];
    setSelectedCodes(chosen.codes);
    setHintIndex((i) => i + 1);
  };

  const handleCycleSortMode = () => {
    setSortMode((prev) => {
      if (prev === 'rank') return 'suit';
      if (prev === 'suit') {
        handOrder.handleAutoOrder();
        return 'auto';
      }
      handOrder.handleResetOrder();
      return 'rank';
    });
    sfx.playCardSnap();
    sfx.triggerCardSnapHaptic(15);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportForm.reportedUserId) {
      toast.error('Pilih pemain yang ingin dilaporkan.');
      return;
    }
    setReporting(true);
    try {
      await pokerApi.reportPlayer({
        roomId,
        reportedUserId: Number(reportForm.reportedUserId),
        reason: reportForm.reason,
        description: reportForm.description.trim() || undefined,
      });
      toast.success('Laporan dikirim.');
      setReportOpen(false);
      setReportForm({ reportedUserId: '', reason: 'harassment', description: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengirim laporan.'));
    } finally {
      setReporting(false);
    }
  };

  const winnerSeatIndex = table?.lastHandResult?.winnerSeat;
  const statusDotColor =
    socketStatus === 'connected'
      ? 'bg-emerald-400'
      : socketStatus === 'reconnecting'
      ? 'bg-amber-400'
      : 'bg-rose-500';

  const showdownState = table?.lastHandResult
    ? {
        open: true,
        winnerName: table.lastHandResult.winnerName,
        handName: `Pemenang Ronde #${table.lastHandResult.handNumber}`,
        potAwarded: table.lastHandResult.totalWon,
        cards: table?.currentPlay?.cards || [],
      }
    : null;

  return (
    <PokerViewportShell theme={preferences.tableTheme}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>

      {/* Tampilan Khusus Capsa Banting (Sesuai Referensi UI Otentik Meja Oval Hijau Kayu di Portrait, Landscape & Desktop) */}
      {tableMode === 'capsa' ? (
        <>
          <LandscapeCapsaTable
            seats={seats}
            viewerSeat={viewerSeat ?? 0}
            currentTurnSeat={table?.currentTurnSeat ?? null}
            starterSeat={table?.starterSeat ?? null}
            winnerSeats={
              winnerSeatIndex !== undefined && winnerSeatIndex !== null ? [winnerSeatIndex] : []
            }
            lastHandResult={table?.lastHandResult || null}
            turnDeadlineAt={table?.turnDeadlineAt || null}
            turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
            serverClockOffsetMs={serverClockOffsetMs || 0}
            room={room}
            myHoleCards={sortedMyCards}
            selectedCodes={selectedCodes}
            onToggleCard={handleToggleCard}
            onSelectCodes={(codes) => setSelectedCodes(codes)}
            validActions={validActions}
            actionBusy={actionBusy}
            onPlaySelected={handlePlaySelected}
            onPass={handlePass}
            onAutoOrder={handOrder.handleAutoOrder}
            onResetOrder={handOrder.handleResetOrder}
            currentPlay={table?.currentPlay || null}
            mustIncludeThreeDiamond={Boolean(table?.mustIncludeThreeDiamond)}
            fourColorDeck={Boolean(preferences.fourColorDeck)}
            cardBackDesign={preferences.cardBack}
            activeAnimationStep={animQueue.activeStep}
            reducedMotion={animQueue.reducedMotion}
            sfx={sfx}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenSettings={() => {
              setMenuTab('settings');
              setMenuOpen(true);
            }}
            onOpenHelp={() => {
              setMenuTab('ranks');
              setMenuOpen(true);
            }}
            sortMode={sortMode}
            onCycleSortMode={handleCycleSortMode}
            orderedCards={handOrder.orderedCards}
            dimmedCodes={handOrder.dimmedCodes}
            comboLabel={handOrder.comboLabel}
            onReorder={handOrder.handleReorder}
            layoutMode={metrics.layoutMode}
          />
          <FlyingTableOverlay
            activeStep={animQueue.activeStep}
            animationSpeed={preferences.animationSpeed}
            reducedMotion={animQueue.reducedMotion}
            cardBackDesign={preferences.cardBack}
            fourColorDeck={Boolean(preferences.fourColorDeck)}
            onFastForward={animQueue.fastForwardAll}
          />
        </>
      ) : (
        /* 5-Zona Proporsional (Nol Scroll di Portrait & Hold'em) */
        <div
          className={`poker-table-zones ${
            metrics.layoutMode === 'mobile_landscape' ? 'is-landscape' : ''
          }`}
        >
          {/* ZONA 1 (≤ 8%): Bar Atas Tipis — 1 Ikon Menu (Kiri), Ronde/Pot (Tengah), 1 Titik Koneksi (Kanan) */}
          <header className="flex items-center justify-between px-1 min-h-0">
            <IconButton
              onClick={() => setMenuOpen(true)}
              aria-label="Buka menu meja"
              className="!min-h-[44px] !min-w-[44px] !text-slate-200"
            >
              <MenuRoundedIcon fontSize="small" />
            </IconButton>

            <span className="poker-text-sm font-bold poker-tabular text-slate-300 truncate">
              Ronde #{room?.handNumber || 1} · Tarif {room?.config?.baseStake || 10}
            </span>

            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 mr-2 ${statusDotColor}`}
              role="status"
              aria-label={socketStatus === 'connected' ? 'Terhubung' : 'Menyambung ulang'}
            />
          </header>

          {/* ZONA 2, 3, dan 4: Lawan Horizontal, 5 Slot Tengah + Pot, Kartu Pemain + Chip */}
          <PokerTable
            theme={preferences.tableTheme}
            cardBackDesign={preferences.cardBack}
            fourColorDeck={Boolean(preferences.fourColorDeck)}
            layoutMode={metrics.layoutMode}
            ultraCompact={metrics.ultraCompact}
            seats={seats}
            viewerSeat={viewerSeat ?? 0}
            currentTurnSeat={table?.currentTurnSeat ?? null}
            starterSeat={table?.starterSeat ?? null}
            winnerSeats={
              winnerSeatIndex !== undefined && winnerSeatIndex !== null ? [winnerSeatIndex] : []
            }
            lastHandResult={table?.lastHandResult || null}
            turnDeadlineAt={table?.turnDeadlineAt || null}
            turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
            serverClockOffsetMs={serverClockOffsetMs}
            currentPlay={table?.currentPlay || null}
            mustIncludeThreeDiamond={Boolean(table?.mustIncludeThreeDiamond)}
            myHoleCards={handOrder.orderedCards}
            selectedCodes={selectedCodes}
            onToggleCard={handleToggleCard}
            activeAnimationStep={animQueue.activeStep}
            reducedMotion={animQueue.reducedMotion}
            showdownState={showdownState}
            sfx={sfx}
            orderedCards={handOrder.orderedCards}
            dimmedCodes={handOrder.dimmedCodes}
            comboLabel={handOrder.comboLabel}
            onReorder={handOrder.handleReorder}
            onAutoOrder={handOrder.handleAutoOrder}
            onResetOrder={handOrder.handleResetOrder}
          />

          {/* Lapisan Animasi Terpisah (Parabolic Arc Lemparan Kartu, Chip & Pot) */}
          <FlyingTableOverlay
            activeStep={animQueue.activeStep}
            animationSpeed={preferences.animationSpeed}
            reducedMotion={animQueue.reducedMotion}
            cardBackDesign={preferences.cardBack}
            fourColorDeck={Boolean(preferences.fourColorDeck)}
            onFastForward={animQueue.fastForwardAll}
          />

          {/* ZONA 5 (≈ 20%): Panel Aksi Jempol (Maks 3 Tombol Saat Giliran, 1 Baris Saat Menunggu) */}
          <div className="poker-zone-action min-h-0">
            <ActionPanel
              mode={tableMode}
              layoutMode={metrics.layoutMode}
              validActions={validActions}
              isMyTurn={isMyTurn}
              phase={room?.phase}
              activeTurnName={activeTurnSeatObj?.fullName || ''}
              selectedCodes={selectedCodes}
              actionBusy={actionBusy}
              onPlaySelected={handlePlaySelected}
              onPass={handlePass}
              onHint={handleHint}
              onAutoOrder={handOrder.handleAutoOrder}
              onResetOrder={handOrder.handleResetOrder}
              autoOrderLabel={handOrder.comboLabel}
              holdemState={{
                canFold: true,
                canCheck: Boolean(validActions?.canPass),
                canCall: true,
                callAmount: room?.config?.baseStake || 20,
                canBet: true,
                canRaise: true,
                minBetOrRaiseTo: (room?.config?.baseStake || 20) * 2,
                maxBetOrRaiseTo: 1000,
                totalPot: (room?.config?.baseStake || 20) * 4,
                step: 5,
              }}
              betAmount={holdemBet}
              onBetAmountChange={setHoldemBet}
              onFold={handlePass}
              onCheck={handlePass}
              onCall={handlePass}
              onBetOrRaise={() => handlePlaySelected()}
            />
          </div>
        </div>
      )}

      {/* SATU MENU SEKUNDER (Bottom Sheet): Info Room, Log, Cheat Sheet, Pengaturan, Keluar */}
      <Drawer
        anchor="bottom"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{
          className:
            '!mx-auto !w-full !max-w-lg !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100 !max-h-[84dvh]',
        }}
      >
        <div className="p-4 space-y-3 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <div>
              <span className="poker-text-sm text-slate-400 font-mono">Room #{roomId}</span>
              <h2 className="m-0 poker-text-md font-extrabold text-white">Menu Meja</h2>
            </div>
            <IconButton
              onClick={() => setMenuOpen(false)}
              aria-label="Tutup menu meja"
              className="!min-h-[44px] !min-w-[44px] !text-slate-300"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          {/* Tab Navigasi Menu Sekunder */}
          <div className="grid grid-cols-3 gap-1.5" role="tablist">
            {[
              { id: 'log', label: 'Log Aksi' },
              { id: 'ranks', label: 'Peringkat' },
              { id: 'settings', label: 'Pengaturan' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={menuTab === t.id}
                onClick={() => setMenuTab(t.id)}
                className={`min-h-[44px] rounded-xl border poker-text-sm font-bold transition ${
                  menuTab === t.id
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {menuTab === 'log' && (
            <div className="poker-flat-elevated p-3 max-h-[38dvh] overflow-y-auto space-y-1.5">
              {actionLog.length === 0 ? (
                <p className="m-0 py-4 text-center poker-text-sm text-slate-400">
                  Belum ada catatan aksi.
                </p>
              ) : (
                actionLog.slice(0, 20).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="border-b border-slate-800 pb-1.5 last:border-b-0 poker-text-sm text-slate-200"
                  >
                    {item.text || String(item)}
                  </div>
                ))
              )}
            </div>
          )}

          {menuTab === 'ranks' && (
            <div className="poker-flat-elevated p-3 space-y-1.5 poker-text-sm text-slate-200">
              <div className="font-bold text-amber-400">Panduan Peringkat Tangan</div>
              <div>1. Royal / Straight Flush — 5 berurutan satu kembang</div>
              <div>2. Four of a Kind (Bom) — 4 kartu angka sama</div>
              <div>3. Full House (Polo) — 3 angka sama + Pair</div>
              <div>4. Flush (Warna) — 5 kartu satu kembang</div>
              <div>5. Straight (Seri) — 5 kartu angka berurutan</div>
              <div>6. Three of a Kind, Pair, High Card (Single)</div>
            </div>
          )}

          {menuTab === 'settings' && (
            <div className="space-y-3">
              {/* Urutan kartu & Mode Panel */}
              <div className="poker-flat-elevated p-3 flex items-center justify-between gap-2">
                <span className="poker-text-sm font-bold">Urutan Kartu Tangan</span>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => setSortMode((m) => (m === 'rank' ? 'suit' : 'rank'))}
                  className="!min-h-[44px] !rounded-xl !border-slate-600 poker-text-sm !normal-case"
                >
                  {sortMode === 'rank' ? 'Berdasarkan Angka' : 'Berdasarkan Kembang'}
                </Button>
              </div>

              <div className="poker-flat-elevated p-3 flex items-center justify-between gap-2">
                <span className="poker-text-sm font-bold">Gaya Panel Aksi</span>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() =>
                    setTableMode((m) => (m === 'capsa' ? 'holdem' : 'capsa'))
                  }
                  className="!min-h-[44px] !rounded-xl !border-slate-600 poker-text-sm !normal-case"
                >
                  {tableMode === 'holdem' ? "Hold'em (Fold/Call/Raise)" : 'Capsa (Lewat/Saran/Banting)'}
                </Button>
              </div>

              {/* Layar Penuh (Hilangkan Address Bar Chrome Android) */}
              <div className="poker-flat-elevated p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="poker-text-sm font-bold">Layar Penuh (Full Screen)</div>
                  <div className="text-xs text-slate-400">Hilangkan address bar & tombol navigasi HP</div>
                </div>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={toggleFullscreen}
                  startIcon={isFullscreen ? <FullscreenExitRoundedIcon /> : <FullscreenRoundedIcon />}
                  className="!min-h-[44px] !rounded-xl !border-slate-600 poker-text-sm !normal-case"
                >
                  {isFullscreen ? 'Keluar' : 'Layar Penuh'}
                </Button>
              </div>

              {/* Audio & Haptik */}
              <div className="poker-flat-elevated p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="poker-text-sm font-bold">Efek Suara (Default Mati)</span>
                  <Switch
                    color="success"
                    checked={Boolean(preferences.sfxEnabled)}
                    onChange={(e) => updatePreferences({ sfxEnabled: e.target.checked })}
                    inputProps={{ 'aria-label': 'Efek suara' }}
                  />
                </div>
                {preferences.sfxEnabled && (
                  <div className="px-1">
                    <Slider
                      size="small"
                      color="success"
                      min={0}
                      max={1}
                      step={0.05}
                      value={Number(preferences.sfxVolume) || 0.65}
                      onChange={(_e, v) => updatePreferences({ sfxVolume: Number(v) })}
                      aria-label="Volume suara"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  <span className="poker-text-sm font-bold">Getaran Giliran</span>
                  <Switch
                    color="warning"
                    checked={Boolean(preferences.hapticsEnabled)}
                    onChange={(e) => updatePreferences({ hapticsEnabled: e.target.checked })}
                    inputProps={{ 'aria-label': 'Getaran giliran' }}
                  />
                </div>
              </div>

              <ThemePicker
                tableTheme={preferences.tableTheme}
                cardBack={preferences.cardBack}
                fourColorDeck={preferences.fourColorDeck}
                animationSpeed={preferences.animationSpeed}
                onChangeTheme={(tableTheme) => updatePreferences({ tableTheme })}
                onChangeCardBack={(cardBack) => updatePreferences({ cardBack })}
                onChangeFourColorDeck={(fourColorDeck) => updatePreferences({ fourColorDeck })}
                onChangeAnimationSpeed={(animationSpeed) => updatePreferences({ animationSpeed })}
              />
            </div>
          )}

          {/* Aksi Room di Bawah Menu Sheet */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            {reportableHumans.length > 0 && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
                className="!min-h-[44px] flex-1 !rounded-xl !border-slate-600 poker-text-sm !normal-case"
              >
                Laporkan
              </Button>
            )}
            {(isHost || isStaff) && (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => {
                  setMenuOpen(false);
                  onEndRoom?.();
                }}
                className="!min-h-[44px] flex-1 !rounded-xl poker-text-sm !normal-case"
              >
                Akhiri Meja
              </Button>
            )}
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                setMenuOpen(false);
                setLeaveConfirmOpen(true);
              }}
              className="!min-h-[44px] flex-1 !rounded-xl poker-text-sm !normal-case"
            >
              Keluar Meja
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Dialog Laporkan Pemain */}
      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleSubmitReport}>
          <DialogTitle className="!font-extrabold">Laporkan Pemain</DialogTitle>
          <DialogContent className="space-y-3 !pt-2">
            <TextField
              select
              label="Pilih Pemain"
              value={reportForm.reportedUserId}
              onChange={(e) => setReportForm({ ...reportForm, reportedUserId: e.target.value })}
              required
            >
              {reportableHumans.map((s) => (
                <MenuItem key={s.userId} value={s.userId}>
                  {s.fullName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Alasan"
              value={reportForm.reason}
              onChange={(e) => setReportForm({ ...reportForm, reason: e.target.value })}
            >
              <MenuItem value="harassment">Perilaku Mengganggu</MenuItem>
              <MenuItem value="inappropriate">Nama / Avatar Tidak Pantas</MenuItem>
              <MenuItem value="spam">Spam</MenuItem>
              <MenuItem value="cheating">Dugaan Kecurangan</MenuItem>
              <MenuItem value="other">Lainnya</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button
              color="inherit"
              onClick={() => setReportOpen(false)}
              disabled={reporting}
              className="!min-h-[44px]"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={reporting}
              className="!min-h-[44px]"
            >
              Kirim
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Keluar dari Meja?"
        message="Jika Anda keluar di tengah permainan, kursi Anda diambil alih oleh Bot sampai ronde selesai."
        confirmText="Ya, Keluar"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          onLeaveRoom();
        }}
      />
    </PokerViewportShell>
  );
}
