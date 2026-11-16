// FILE: client/src/components/poker/PokerTableView.jsx
import { useEffect, useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import PokerCard from './PokerCard';
import PokerActionPanel from './PokerActionPanel';
import ConfirmDialog from '../common/ConfirmDialog';
import { pokerApi } from '../../api/poker.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';

const RANK_POWER = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9, 13: 10, 14: 11, 2: 12 };
const SUIT_POWER = { D: 0, C: 1, H: 2, S: 3 };

function TurnCountdownBadge({ turnDeadlineAt, turnTimeoutSec, serverClockOffsetMs }) {
  const [secLeft, setSecLeft] = useState(turnTimeoutSec);

  useEffect(() => {
    const update = () => {
      const approxServerNow = Date.now() + (serverClockOffsetMs || 0);
      const rem = Math.max(0, Math.ceil(((turnDeadlineAt || approxServerNow) - approxServerNow) / 1000));
      setSecLeft(rem);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [turnDeadlineAt, turnTimeoutSec, serverClockOffsetMs]);

  const pct = Math.min(100, Math.max(0, (secLeft / Math.max(1, turnTimeoutSec)) * 100));
  const stroke = secLeft <= 7 ? '#ef4444' : '#10b981';

  return (
    <div className="relative inline-flex h-8 w-8 items-center justify-center shrink-0" title={`Sisa ${secLeft} detik`}>
      <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="94.25"
          strokeDashoffset={94.25 - (pct / 100) * 94.25}
        />
      </svg>
      <span className="absolute text-[10px] font-black text-white">{secLeft}</span>
    </div>
  );
}

function OpponentSeatCard({
  seat,
  isTurn = false,
  isWinner = false,
  reaction = null,
  turnDeadlineAt = null,
  turnTimeoutSec = 30,
  serverClockOffsetMs = 0,
  canKick = false,
  onKick,
}) {
  if (!seat) return null;

  return (
    <div
      className={`relative rounded-2xl border p-2 sm:p-2.5 transition-all backdrop-blur-md ${
        isWinner
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400/70'
          : isTurn
          ? 'border-emerald-400 bg-slate-900/90 ring-2 ring-emerald-400/60 shadow-lg'
          : 'border-white/15 bg-slate-900/75'
      }`}
    >
      {reaction?.emote && (
        <div
          className="absolute -top-3 right-2 z-20 rounded-full bg-white px-2 py-0.5 text-sm shadow-lg ring-1 ring-emerald-500 motion-reduce:animate-none animate-bounce"
          aria-live="polite"
        >
          {reaction.emote}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={getOptimizedImageUrl(seat.avatarUrl, { width: 64, height: 64 })}
            sx={{ width: 32, height: 32, fontSize: 12 }}
          >
            {seat.isBot ? <SmartToyRoundedIcon fontSize="small" /> : getInitials(seat.fullName)}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-xs font-bold text-white max-w-[96px] sm:max-w-[130px]">
                {seat.fullName}
              </span>
              {seat.isBot && (
                <span className="rounded bg-sky-500/30 px-1 text-[9px] font-bold text-sky-200">
                  BOT
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold text-emerald-300">
              <span>{seat.chips.toLocaleString('id-ID')}</span>
              <span className="rounded-md bg-white/15 px-1.5 py-0.2 text-[10px] font-black text-amber-200">
                {seat.cardCount} Kartu
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isTurn && !seat.isBot && turnDeadlineAt && (
            <TurnCountdownBadge
              turnDeadlineAt={turnDeadlineAt}
              turnTimeoutSec={turnTimeoutSec}
              serverClockOffsetMs={serverClockOffsetMs}
            />
          )}
          {canKick && (
            <Tooltip title="Keluarkan pemain">
              <IconButton
                size="small"
                color="error"
                onClick={() => onKick(seat.userId)}
                aria-label={`Keluarkan ${seat.fullName}`}
                className="!p-1 !text-rose-300"
              >
                <PersonRemoveRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {(seat.hasPassed || seat.isAway || !seat.connected || isWinner) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {seat.hasPassed && (
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-200">
              LEWAT (PASS)
            </span>
          )}
          {isWinner && (
            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-slate-900">
              MENANG RONDE
            </span>
          )}
          {seat.isAway && (
            <span className="rounded bg-orange-500/30 px-1.5 py-0.5 text-[9px] font-bold text-orange-200">
              AWAY
            </span>
          )}
          {!seat.connected && !seat.isBot && (
            <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-200">
              TERPUTUS
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PokerTableView({
  roomState,
  currentUserId,
  currentUserRole,
  socketStatus,
  serverClockOffsetMs,
  actionLog,
  seatReactions,
  fourColorDeck,
  soundEnabled,
  actionBusy,
  onToggleFourColor,
  onToggleSound,
  onGameAction,
  onSendReaction,
  onLeaveRoom,
  onEndRoom,
  onKickPlayer,
}) {
  const [logOpen, setLogOpen] = useState(false);
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

  const { roomId, room, table, viewerSeat, myHoleCards, validActions } = roomState;
  const seats = table?.seats || [];
  const isHost = room?.hostUserId === currentUserId;
  const isStaff = ['admin', 'moderator'].includes(currentUserRole);
  const mySeat = seats.find((s) => s.userId === currentUserId) || null;
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

  // Reset pilihan bila kartu tangan berubah atau ronde baru dimulai
  useEffect(() => {
    const owned = new Set((myHoleCards || []).map((c) => c.code));
    setSelectedCodes((prev) => prev.filter((code) => owned.has(code)));
    setHintIndex(0);
  }, [myHoleCards, room?.handNumber, table?.currentTurnSeat]);

  const relativeSeatMap = useMemo(() => {
    const base = viewerSeat ?? 0;
    const byOffset = (offset) => seats.find((s) => s.seatIndex === (base + offset) % 4) || null;
    return {
      bottom: byOffset(0),
      left: byOffset(1),
      top: byOffset(2),
      right: byOffset(3),
    };
  }, [seats, viewerSeat]);

  const activeTurnSeatObj = seats.find((s) => s.seatIndex === table?.currentTurnSeat);
  const isMyTurn = viewerSeat !== null && table?.currentTurnSeat === viewerSeat;

  const selectionSummary = useMemo(() => {
    if (selectedCodes.length === 0) return null;
    const matchedHint = (validActions?.suggestedMoves || []).find(
      (m) =>
        m.codes.length === selectedCodes.length &&
        selectedCodes.every((c) => m.codes.includes(c))
    );
    if (matchedHint) return matchedHint.label;
    return `${selectedCodes.length} kartu dipilih`;
  }, [selectedCodes, validActions?.suggestedMoves]);

  const liveAnnouncement = useMemo(() => {
    if (table?.lastHandResult) {
      return `Ronde #${table.lastHandResult.handNumber} dimenangkan oleh ${table.lastHandResult.winnerName}.`;
    }
    if (isMyTurn) return 'Giliran Anda di meja Capsa Banting.';
    if (activeTurnSeatObj) return `Giliran ${activeTurnSeatObj.fullName}.`;
    return '';
  }, [table?.lastHandResult, isMyTurn, activeTurnSeatObj]);

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
      toast.error(err.message || 'Kombinasi kartu belum sah atau kurang tinggi.');
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
      toast.info('Tidak ada kombinasi yang bisa membanting kartu meja. Tekan Lewat (Pass).');
      return;
    }
    const chosen = hints[hintIndex % hints.length];
    setSelectedCodes(chosen.codes);
    setHintIndex((i) => i + 1);
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
      toast.success('Laporan berhasil dikirim ke moderator.');
      setReportOpen(false);
      setReportForm({ reportedUserId: '', reason: 'harassment', description: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengirim laporan.'));
    } finally {
      setReporting(false);
    }
  };

  const canKickSeat = (seat) => {
    if (!isHost || !seat || seat.isBot || seat.userId === currentUserId) return false;
    return room?.phase === 'antar_tangan' || seat.isAway || !seat.connected;
  };

  const winnerSeatIndex = table?.lastHandResult?.winnerSeat;

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] lg:min-h-[calc(100dvh-6.2rem)] flex-col justify-between gap-2 overflow-hidden">
      <span className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </span>

      {/* Top Bar Meja Ringkas */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-navy-800/90">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs sm:text-sm font-black tracking-wider text-slate-900 dark:text-white">
            #{roomId}
          </span>
          <Chip
            size="small"
            color={socketStatus === 'connected' ? 'success' : 'warning'}
            label={
              socketStatus === 'connected'
                ? 'Terhubung'
                : socketStatus === 'reconnecting'
                ? 'Menyambung Ulang'
                : 'Terputus'
            }
            className="!h-5 !text-[10px]"
          />
          <span className="hidden sm:inline text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Ronde #{room?.handNumber} · Tarif {room?.config?.baseStake || 10} chip/kartu
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip title={fourColorDeck ? 'Pakai 2 Warna Standar' : 'Mode 4 Warna (Buta Warna)'}>
            <IconButton
              size="small"
              onClick={onToggleFourColor}
              color={fourColorDeck ? 'success' : 'default'}
              aria-label="Toggle 4 warna kartu"
              className="!min-h-[40px] !min-w-[40px]"
            >
              <PaletteRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara Giliran'}>
            <IconButton
              size="small"
              onClick={onToggleSound}
              aria-label="Toggle suara"
              className="!min-h-[40px] !min-w-[40px]"
            >
              {soundEnabled ? <VolumeUpRoundedIcon fontSize="small" /> : <VolumeOffRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Log Aksi Singkat">
            <IconButton
              size="small"
              onClick={() => setLogOpen(true)}
              aria-label="Buka log aksi"
              className="!min-h-[40px] !min-w-[40px]"
            >
              <HistoryRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {reportableHumans.length > 0 && (
            <Tooltip title="Laporkan Pemain">
              <IconButton
                size="small"
                onClick={() => setReportOpen(true)}
                aria-label="Laporkan pemain"
                className="!min-h-[40px] !min-w-[40px]"
              >
                <FlagRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {(isHost || isStaff) && (
            <Tooltip title="Akhiri Meja">
              <IconButton
                size="small"
                color="warning"
                onClick={() => onEndRoom()}
                aria-label="Akhiri permainan"
                className="!min-h-[40px] !min-w-[40px]"
              >
                <StopCircleOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Keluar dari Meja">
            <IconButton
              size="small"
              color="error"
              onClick={() => setLeaveConfirmOpen(true)}
              aria-label="Keluar room"
              className="!min-h-[40px] !min-w-[40px]"
            >
              <ExitToAppRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Meja Hijau Capsa Banting */}
      <div className="relative flex-1 rounded-3xl border-4 border-emerald-950/90 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 p-2.5 sm:p-4 shadow-2xl flex flex-col justify-between gap-2.5">
        {/* Lawan Atas */}
        <div className="mx-auto w-full max-w-xs">
          <OpponentSeatCard
            seat={relativeSeatMap.top}
            isTurn={relativeSeatMap.top?.seatIndex === table?.currentTurnSeat}
            isWinner={relativeSeatMap.top?.seatIndex === winnerSeatIndex}
            reaction={seatReactions[relativeSeatMap.top?.seatIndex]}
            turnDeadlineAt={table?.turnDeadlineAt}
            turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
            serverClockOffsetMs={serverClockOffsetMs}
            canKick={canKickSeat(relativeSeatMap.top)}
            onKick={onKickPlayer}
          />
        </div>

        {/* Baris Tengah: Kiri + Area Banting Tengah + Kanan */}
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
          <div className="sm:col-span-3">
            <OpponentSeatCard
              seat={relativeSeatMap.left}
              isTurn={relativeSeatMap.left?.seatIndex === table?.currentTurnSeat}
              isWinner={relativeSeatMap.left?.seatIndex === winnerSeatIndex}
              reaction={seatReactions[relativeSeatMap.left?.seatIndex]}
              turnDeadlineAt={table?.turnDeadlineAt}
              turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
              serverClockOffsetMs={serverClockOffsetMs}
              canKick={canKickSeat(relativeSeatMap.left)}
              onKick={onKickPlayer}
            />
          </div>

          {/* Tengah: Kartu yang sedang di Meja */}
          <div className="sm:col-span-6 flex flex-col items-center justify-center gap-2 py-2 min-h-[120px]">
            {table?.lastHandResult ? (
              <div className="w-full max-w-sm rounded-2xl bg-black/55 border border-amber-400/50 p-3 text-center space-y-1.5">
                <div className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  {table.lastHandResult.winnerName} Menang Ronde #{table.lastHandResult.handNumber} (+
                  {table.lastHandResult.totalWon} chip)
                </div>
                <div className="space-y-0.5 text-[11px] text-slate-200">
                  {table.lastHandResult.penalties.map((pen) => (
                    <div key={pen.seatIndex} className="flex justify-between gap-2">
                      <span className="truncate">{pen.fullName}</span>
                      <span className="text-rose-300 shrink-0">
                        -{pen.penaltyAmount} chip ({pen.remainingCount} kartu ×{pen.multiplier})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : table?.currentPlay ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="rounded-full bg-black/45 px-3 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-400/30">
                  {table.currentPlay.label} · {table.currentPlay.fullName}
                </span>
                <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
                  {table.currentPlay.cards.map((c) => (
                    <PokerCard
                      key={c.code}
                      card={c}
                      size="md"
                      fourColor={fourColorDeck}
                      highlight={table.currentPlay.isBomb}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/25 bg-black/25 px-4 py-3 text-center text-xs font-semibold text-emerald-100">
                {table?.mustIncludeThreeDiamond
                  ? 'Ronde #1 Pembuka — Banting kombinasi yang menyertakan 3♦'
                  : 'Meja Kosong — Silakan banting 1, 2, 3, atau 5 kartu kombinasi'}
              </div>
            )}
          </div>

          <div className="sm:col-span-3">
            <OpponentSeatCard
              seat={relativeSeatMap.right}
              isTurn={relativeSeatMap.right?.seatIndex === table?.currentTurnSeat}
              isWinner={relativeSeatMap.right?.seatIndex === winnerSeatIndex}
              reaction={seatReactions[relativeSeatMap.right?.seatIndex]}
              turnDeadlineAt={table?.turnDeadlineAt}
              turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
              serverClockOffsetMs={serverClockOffsetMs}
              canKick={canKickSeat(relativeSeatMap.right)}
              onKick={onKickPlayer}
            />
          </div>
        </div>

        {/* Area Kartu Sendiri (Bawah — 13 Kartu Interaktif) */}
        <div className="space-y-2 pt-1">
          {mySeat && (
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-xs font-extrabold text-white">
                  {mySeat.fullName} (Kamu)
                </span>
                <span className="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[11px] font-black text-emerald-200">
                  {mySeat.chips.toLocaleString('id-ID')} chip · {sortedMyCards.length} kartu
                </span>
                {mySeat.hasPassed && (
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                    LEWAT
                  </span>
                )}
              </div>
              {isMyTurn && table?.turnDeadlineAt && (
                <TurnCountdownBadge
                  turnDeadlineAt={table.turnDeadlineAt}
                  turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
                  serverClockOffsetMs={serverClockOffsetMs}
                />
              )}
            </div>
          )}

          {/* Deretan Kartu di Tangan (mudah dipilih di layar 360px maupun desktop) */}
          <div
            className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 pt-2 pb-1 px-1"
            role="group"
            aria-label="Kartu di tangan Anda"
          >
            {sortedMyCards.map((c) => (
              <PokerCard
                key={c.code}
                card={c}
                size="lg"
                fourColor={fourColorDeck}
                selected={selectedCodes.includes(c.code)}
                onClick={() => handleToggleCard(c.code)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Panel Aksi Big 2 Offline */}
      <PokerActionPanel
        validActions={validActions}
        isMyTurn={isMyTurn}
        phase={room?.phase}
        activeTurnName={activeTurnSeatObj?.fullName || ''}
        selectedCodes={selectedCodes}
        selectionSummary={selectionSummary}
        sortMode={sortMode}
        actionBusy={actionBusy}
        onPlaySelected={handlePlaySelected}
        onPass={handlePass}
        onHint={handleHint}
        onClearSelection={() => setSelectedCodes([])}
        onToggleSortMode={() => setSortMode((m) => (m === 'rank' ? 'suit' : 'rank'))}
        onSendReaction={onSendReaction}
      />

      {/* Drawer Log Aksi */}
      <Drawer anchor="right" open={logOpen} onClose={() => setLogOpen(false)}>
        <div className="w-72 sm:w-80 p-4 space-y-3 bg-white dark:bg-navy-800 h-full overflow-y-auto">
          <h3 className="m-0 text-sm font-extrabold text-slate-900 dark:text-white">
            Log Aksi Meja
          </h3>
          {actionLog.length === 0 ? (
            <p className="text-xs text-slate-400">Belum ada catatan aksi.</p>
          ) : (
            <div className="space-y-2">
              {actionLog.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-navy dark:text-slate-200"
                >
                  {item.text}
                </div>
              ))}
            </div>
          )}
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
              <MenuItem value="harassment">Perilaku Mengganggu / Kasar</MenuItem>
              <MenuItem value="inappropriate">Nama / Avatar Tidak Pantas</MenuItem>
              <MenuItem value="spam">Spam Reaksi</MenuItem>
              <MenuItem value="cheating">Dugaan Kecurangan</MenuItem>
              <MenuItem value="other">Lainnya</MenuItem>
            </TextField>
            <TextField
              label="Keterangan Tambahan (Opsional)"
              multiline
              minRows={2}
              value={reportForm.description}
              onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
              inputProps={{ maxLength: 500 }}
            />
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setReportOpen(false)} disabled={reporting}>
              Batal
            </Button>
            <Button type="submit" variant="contained" color="error" disabled={reporting}>
              {reporting ? 'Mengirim...' : 'Kirim Laporan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Keluar dari Meja Capsa Banting?"
        message="Jika Anda keluar di tengah permainan saat mabar, kursi Anda diambil alih sementara oleh Bot agar ronde tetap berjalan adil."
        confirmText="Ya, Keluar"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          onLeaveRoom();
        }}
      />
    </div>
  );
}
