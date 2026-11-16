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
import PokerCard from './PokerCard';
import PokerActionPanel from './PokerActionPanel';
import ConfirmDialog from '../common/ConfirmDialog';
import { pokerApi } from '../../api/poker.api';
import { getErrorMessage } from '../../api/axiosInstance';
import { toast } from '../../store/useThemeStore';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { getInitials } from '../../utils/constants';

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
      <span className="absolute text-[10px] font-black text-slate-900 dark:text-white">{secLeft}</span>
    </div>
  );
}

function SeatCard({
  seat,
  isSelf = false,
  isTurn = false,
  isDealer = false,
  isSb = false,
  isBb = false,
  isWinner = false,
  reaction = null,
  fourColor = false,
  turnDeadlineAt = null,
  turnTimeoutSec = 30,
  serverClockOffsetMs = 0,
  winningCardCodes = new Set(),
  canKick = false,
  onKick,
}) {
  if (!seat) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-black/15 px-3 py-2 text-center text-[11px] text-white/50">
        Kursi Kosong
      </div>
    );
  }

  const cardsToShow = seat.holeCards;

  return (
    <div
      className={`relative rounded-2xl border p-2 sm:p-2.5 transition-all backdrop-blur-md ${
        isWinner
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400/70'
          : isTurn
          ? 'border-emerald-400 bg-slate-900/90 ring-2 ring-emerald-400/60 shadow-lg'
          : 'border-white/15 bg-slate-900/75'
      } ${seat.folded ? 'opacity-65' : ''}`}
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
            sx={{ width: isSelf ? 36 : 30, height: isSelf ? 36 : 30, fontSize: 12 }}
          >
            {getInitials(seat.fullName)}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-xs font-bold text-white max-w-[96px] sm:max-w-[135px]">
                {seat.fullName}
                {isSelf ? ' (Kamu)' : ''}
              </span>
              {isDealer && (
                <span className="rounded-full bg-amber-400 px-1.5 py-0 text-[9px] font-black text-slate-900">
                  D
                </span>
              )}
              {isSb && (
                <span className="rounded bg-sky-500/30 px-1 text-[9px] font-bold text-sky-200">
                  SB
                </span>
              )}
              {isBb && (
                <span className="rounded bg-violet-500/30 px-1 text-[9px] font-bold text-violet-200">
                  BB
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[11px] font-extrabold text-emerald-300">
              <span>{seat.chips.toLocaleString('id-ID')} chip</span>
              {seat.streetBet > 0 && (
                <span className="rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-200">
                  Bet {seat.streetBet}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isTurn && turnDeadlineAt && (
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

      {/* Status chips & hole cards */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {seat.folded && (
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
              FOLD
            </span>
          )}
          {seat.allIn && (
            <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
              ALL-IN
            </span>
          )}
          {seat.isAway && (
            <span className="rounded bg-orange-500/30 px-1.5 py-0.5 text-[9px] font-bold text-orange-200">
              AWAY
            </span>
          )}
          {!seat.connected && (
            <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-200">
              TERPUTUS
            </span>
          )}
        </div>

        {seat.inHand && (cardsToShow || seat.hasCards) && (
          <div className="flex items-center gap-1">
            {cardsToShow ? (
              cardsToShow.map((c) => (
                <PokerCard
                  key={c.code}
                  card={c}
                  size={isSelf ? 'md' : 'xs'}
                  fourColor={fourColor}
                  highlight={winningCardCodes.has(c.code)}
                />
              ))
            ) : (
              <>
                <PokerCard faceDown size="xs" />
                <PokerCard faceDown size="xs" />
              </>
            )}
          </div>
        )}
      </div>
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

  const { roomId, room, table, viewerSeat, validActions } = roomState;
  const seats = table?.seats || [];
  const isHost = room?.hostUserId === currentUserId;
  const isStaff = ['admin', 'moderator'].includes(currentUserRole);
  const mySeat = seats.find((s) => s.userId === currentUserId) || null;
  const otherSeats = seats.filter((s) => s.userId !== currentUserId);

  // Petakan kursi secara relatif: "Kamu" selalu berada di posisi bawah
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

  const winnerSeatSet = useMemo(
    () => new Set(table?.lastHandResult?.winnerSeats || []),
    [table?.lastHandResult]
  );

  const winningCardCodes = useMemo(() => {
    const set = new Set();
    const revealed = table?.lastHandResult?.revealedHands || {};
    for (const seatIdx of winnerSeatSet) {
      const codes = revealed[seatIdx]?.bestFiveCodes || [];
      codes.forEach((c) => set.add(c));
    }
    return set;
  }, [table?.lastHandResult, winnerSeatSet]);

  const liveAnnouncement = useMemo(() => {
    if (table?.lastHandResult?.reason === 'showdown') {
      return `Tangan #${table.lastHandResult.handNumber} showdown selesai.`;
    }
    if (table?.lastHandResult?.reason === 'fold') {
      return `Tangan #${table.lastHandResult.handNumber} dimenangkan lewat fold.`;
    }
    if (isMyTurn) return 'Giliran Anda untuk bertindak.';
    if (activeTurnSeatObj) return `Giliran ${activeTurnSeatObj.fullName}.`;
    return '';
  }, [table?.lastHandResult, isMyTurn, activeTurnSeatObj]);

  const handleAction = async (action, amount = undefined) => {
    try {
      await onGameAction({
        roomId,
        handNumber: room.handNumber,
        turnToken: table.turnToken,
        action,
        amount,
      });
    } catch (err) {
      toast.error(err.message || 'Gagal menjalankan aksi.');
    }
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
    if (!isHost || !seat || seat.userId === currentUserId) return false;
    return room?.phase === 'antar_tangan' || seat.isAway || !seat.connected;
  };

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
            Tangan #{room?.handNumber} · Blind {room?.config?.blindLevel}
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
          {otherSeats.length > 0 && (
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

      {/* Meja Felt Hijau Tua Tenang & Posisi 4 Kursi */}
      <div className="relative flex-1 rounded-3xl border-4 border-emerald-950/90 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 p-2.5 sm:p-4 shadow-2xl flex flex-col justify-between gap-2.5">
        {/* Kursi Atas */}
        <div className="mx-auto w-full max-w-xs">
          <SeatCard
            seat={relativeSeatMap.top}
            isTurn={relativeSeatMap.top?.seatIndex === table?.currentTurnSeat}
            isDealer={relativeSeatMap.top?.seatIndex === table?.dealerSeat}
            isSb={relativeSeatMap.top?.seatIndex === table?.sbSeat}
            isBb={relativeSeatMap.top?.seatIndex === table?.bbSeat}
            isWinner={winnerSeatSet.has(relativeSeatMap.top?.seatIndex)}
            reaction={seatReactions[relativeSeatMap.top?.seatIndex]}
            fourColor={fourColorDeck}
            turnDeadlineAt={table?.turnDeadlineAt}
            turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
            serverClockOffsetMs={serverClockOffsetMs}
            winningCardCodes={winningCardCodes}
            canKick={canKickSeat(relativeSeatMap.top)}
            onKick={onKickPlayer}
          />
        </div>

        {/* Baris Tengah: Kursi Kiri + Pot & Community Cards + Kursi Kanan */}
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2">
          <div className="sm:col-span-3">
            {relativeSeatMap.left && (
              <SeatCard
                seat={relativeSeatMap.left}
                isTurn={relativeSeatMap.left.seatIndex === table?.currentTurnSeat}
                isDealer={relativeSeatMap.left.seatIndex === table?.dealerSeat}
                isSb={relativeSeatMap.left.seatIndex === table?.sbSeat}
                isBb={relativeSeatMap.left.seatIndex === table?.bbSeat}
                isWinner={winnerSeatSet.has(relativeSeatMap.left.seatIndex)}
                reaction={seatReactions[relativeSeatMap.left.seatIndex]}
                fourColor={fourColorDeck}
                turnDeadlineAt={table?.turnDeadlineAt}
                turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
                serverClockOffsetMs={serverClockOffsetMs}
                winningCardCodes={winningCardCodes}
                canKick={canKickSeat(relativeSeatMap.left)}
                onKick={onKickPlayer}
              />
            )}
          </div>

          {/* Tengah: Pot & 5 Kartu Meja */}
          <div className="sm:col-span-6 flex flex-col items-center justify-center gap-2 py-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="rounded-full bg-black/40 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-400/30">
                Pot: {(table?.totalPot || 0).toLocaleString('id-ID')}
              </span>
              {(table?.sidePots || []).length > 1 &&
                table.sidePots.map((sp) => (
                  <span
                    key={sp.potIndex}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100"
                  >
                    {sp.potIndex === 0 ? 'Main' : `Side ${sp.potIndex}`}: {sp.amount}
                  </span>
                ))}
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white/80">
                {room?.phase}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {[0, 1, 2, 3, 4].map((idx) => {
                const c = table?.communityCards?.[idx];
                if (!c) {
                  return (
                    <div
                      key={idx}
                      className="h-14 w-10 sm:h-20 sm:w-14 rounded-xl border border-dashed border-white/20 bg-white/5"
                    />
                  );
                }
                return (
                  <PokerCard
                    key={c.code}
                    card={c}
                    size="sm"
                    fourColor={fourColorDeck}
                    highlight={winningCardCodes.has(c.code)}
                  />
                );
              })}
            </div>

            {table?.lastHandResult && (
              <div className="rounded-xl bg-black/50 px-3 py-1 text-center text-[11px] font-bold text-amber-200 border border-amber-400/30">
                {table.lastHandResult.reason === 'fold'
                  ? `Menang lewat Fold (${table.lastHandResult.totalPot} chip)`
                  : Object.values(table.lastHandResult.revealedHands || {})
                      .filter((_, i) => i < 2)
                      .map((h) => `${h.fullName}: ${h.categoryName}`)
                      .join(' · ')}
              </div>
            )}
          </div>

          <div className="sm:col-span-3">
            {relativeSeatMap.right && (
              <SeatCard
                seat={relativeSeatMap.right}
                isTurn={relativeSeatMap.right.seatIndex === table?.currentTurnSeat}
                isDealer={relativeSeatMap.right.seatIndex === table?.dealerSeat}
                isSb={relativeSeatMap.right.seatIndex === table?.sbSeat}
                isBb={relativeSeatMap.right.seatIndex === table?.bbSeat}
                isWinner={winnerSeatSet.has(relativeSeatMap.right.seatIndex)}
                reaction={seatReactions[relativeSeatMap.right.seatIndex]}
                fourColor={fourColorDeck}
                turnDeadlineAt={table?.turnDeadlineAt}
                turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
                serverClockOffsetMs={serverClockOffsetMs}
                winningCardCodes={winningCardCodes}
                canKick={canKickSeat(relativeSeatMap.right)}
                onKick={onKickPlayer}
              />
            )}
          </div>
        </div>

        {/* Kursi Bawah (Pemain Sendiri) */}
        <div className="mx-auto w-full max-w-md">
          <SeatCard
            seat={relativeSeatMap.bottom}
            isSelf
            isTurn={relativeSeatMap.bottom?.seatIndex === table?.currentTurnSeat}
            isDealer={relativeSeatMap.bottom?.seatIndex === table?.dealerSeat}
            isSb={relativeSeatMap.bottom?.seatIndex === table?.sbSeat}
            isBb={relativeSeatMap.bottom?.seatIndex === table?.bbSeat}
            isWinner={winnerSeatSet.has(relativeSeatMap.bottom?.seatIndex)}
            reaction={seatReactions[relativeSeatMap.bottom?.seatIndex]}
            fourColor={fourColorDeck}
            turnDeadlineAt={table?.turnDeadlineAt}
            turnTimeoutSec={room?.config?.turnTimeoutSec || 30}
            serverClockOffsetMs={serverClockOffsetMs}
            winningCardCodes={winningCardCodes}
          />
        </div>
      </div>

      {/* Panel Aksi Jempol di Bawah */}
      <PokerActionPanel
        validActions={validActions}
        totalPot={table?.totalPot || 0}
        isMyTurn={isMyTurn}
        mySeat={mySeat}
        phase={room?.phase}
        activeTurnName={activeTurnSeatObj?.fullName || ''}
        actionBusy={actionBusy}
        onAction={handleAction}
        onSendReaction={onSendReaction}
      />

      {/* Drawer Log Aksi Singkat */}
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
              {otherSeats.map((s) => (
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
        title="Keluar dari Meja Poker?"
        message="Jika Anda keluar di tengah tangan berjalan, kartu Anda otomatis di-fold dan chip yang sudah di pot tetap di pot."
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
