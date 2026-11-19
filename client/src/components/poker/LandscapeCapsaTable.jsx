// FILE: client/src/components/poker/LandscapeCapsaTable.jsx
import { useEffect, useMemo, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import DraggableHand from './DraggableHand';
import PlayingCard from './PlayingCard';
import {
  mapSeatsRelativeToViewer,
  formatCompactChips,
  formatPlayerShortName,
  findAvailableCombosInHand,
  canBeatPlay,
} from '../../utils/pokerUiHelpers';
import { getOptimizedImageUrl } from '../../hooks/useCloudinaryUrl';
import { useFullscreen } from '../../utils/useFullscreen';
import useAuthStore from '../../store/useAuthStore';

/**
 * Landscape & Desktop Capsa Banting UI yang otentik dan kaya fitur sesuai referensi:
 * - Meja oval hijau/teal dengan lis kayu tebal (wood rail) dan lintasan felt
 * - Header: tombol bulat Menu (<), Pengaturan (gear), Bantuan/Peringkat (?) di kiri, info Room/Tarif di kanan
 * - Lawan: Kipas kartu dengan badge sisa kartu [12], avatar, nama & chip di atas, kiri, dan kanan meja
 * - Kartu tengah: trick kartu yang dibanting dengan label kombinasi di bawahnya (Single, Pair, Full House, dll)
 * - Tombol PASS (Lewat) merah di sisi kiri meja & PLAY (Banting) emas/perunggu di sisi kanan meja
 * - Pintasan Kombinasi (Combo Selector) di kiri bawah: Single, Full House, Three of A Kind, Pair (dengan dot hijau saat valid)
 * - Kontrol Urutan di kanan bawah: Reset & Sort (Rank/Suit/Auto)
 * - Kartu tangan pemain di bawah meja dengan drag & drop halus (responsif mobile landscape, tablet, hingga desktop lebar)
 */
export default function LandscapeCapsaTable({
  seats = [],
  viewerSeat = 0,
  currentTurnSeat = null,
  dealerSeat = null,
  sbSeat = null,
  bbSeat = null,
  starterSeat = null,
  winnerSeats = [],
  lastHandResult = null,
  turnDeadlineAt = null,
  turnTimeoutSec = 30,
  serverClockOffsetMs = 0,
  room = {},
  myHoleCards = [],
  selectedCodes = [],
  onToggleCard = null,
  onSelectCodes = null,
  validActions = {},
  actionBusy = false,
  onPlaySelected = null,
  onPass = null,
  onAutoOrder = null,
  onResetOrder = null,
  currentPlay = null,
  mustIncludeThreeDiamond = false,
  fourColorDeck = false,
  cardBackDesign = 'pasim_crest',
  activeAnimationStep = null,
  reducedMotion = false,
  sfx = null,
  onOpenMenu = null,
  onOpenSettings = null,
  onOpenHelp = null,
  sortMode = 'rank',
  onCycleSortMode = null,
  orderedCards = null,
  dimmedCodes = null,
  comboLabel = '',
  onReorder = null,
  layoutMode = 'desktop',
  currentUser = null,
}) {
  const isPortrait = layoutMode === 'mobile_portrait';
  const isDesktop = layoutMode === 'desktop' || layoutMode === 'tablet';
  const authUser = useAuthStore((s) => s.user);

  const rel = useMemo(
    () => mapSeatsRelativeToViewer(seats, viewerSeat, 4),
    [seats, viewerSeat]
  );

  const myAvatarUrl =
    rel.bottom?.avatarUrl ||
    rel.bottom?.avatar_url ||
    currentUser?.avatar_url ||
    authUser?.avatar_url ||
    null;

  const myName =
    rel.bottom?.fullName ||
    currentUser?.full_name ||
    authUser?.full_name ||
    'Player';

  const myChips = rel.bottom?.chips ?? (authUser?.chips || 808500);

  const isMyTurn = viewerSeat !== null && currentTurnSeat === viewerSeat;
  const displayCards = orderedCards || myHoleCards;
  const boardCards = currentPlay?.cards || [];

  // Hitung ketersediaan seluruh 10 kombinasi di tangan secara dinamis untuk combo pills di kiri bawah
  const combosInHand = useMemo(() => {
    return findAvailableCombosInHand(displayCards, validActions?.suggestedMoves || [], {
      currentPlay,
      mustIncludeThreeDiamond,
    });
  }, [displayCards, validActions?.suggestedMoves, currentPlay, mustIncludeThreeDiamond]);

  // Validasi apakah kartu yang dipilih pemain saat ini sah untuk dimainkan
  const isSelectedPlayValid = useMemo(() => {
    if (!isMyTurn || selectedCodes.length === 0) return false;
    const cardMap = new Map((displayCards || []).map((c) => [c.code, c]));
    const selectedCards = selectedCodes.map((code) => cardMap.get(code)).filter(Boolean);
    if (selectedCards.length !== selectedCodes.length) return false;

    // Cek kecocokan langsung dengan langkah sah yang disarankan server
    const isSuggested = (validActions?.suggestedMoves || []).some(
      (m) =>
        m.codes &&
        m.codes.length === selectedCodes.length &&
        m.codes.every((c) => selectedCodes.includes(c))
    );
    if (isSuggested) return true;

    // Validasi aturan permainan Capsa Banting
    return canBeatPlay(selectedCards, currentPlay, { mustIncludeThreeDiamond });
  }, [
    isMyTurn,
    selectedCodes,
    displayCards,
    validActions?.suggestedMoves,
    currentPlay,
    mustIncludeThreeDiamond,
  ]);

  const canPass = Boolean(isMyTurn && validActions?.canPass);
  const canPlay = Boolean(
    isMyTurn &&
      selectedCodes.length > 0 &&
      isSelectedPlayValid &&
      validActions?.canPlay !== false
  );

  // Siklus pemilihan kombo saat tombol filter ditekan
  const [comboCycleIndex, setComboCycleIndex] = useState({});
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [comboDropdownOpen, setComboDropdownOpen] = useState(false);

  // Status Pemenang Ronde & Animasi Kemenangan
  const winnerSeatIndex =
    lastHandResult?.winnerSeat !== undefined && lastHandResult?.winnerSeat !== null
      ? lastHandResult.winnerSeat
      : winnerSeats.length > 0
      ? winnerSeats[0]
      : null;
  const hasWinner = winnerSeatIndex !== null && winnerSeatIndex !== undefined;

  const isBottomWinner = hasWinner && rel.bottom?.seatIndex === winnerSeatIndex;
  const isTopWinner = hasWinner && rel.top?.seatIndex === winnerSeatIndex;
  const isLeftWinner = hasWinner && rel.left?.seatIndex === winnerSeatIndex;
  const isRightWinner = hasWinner && rel.right?.seatIndex === winnerSeatIndex;

  const winnerName = isBottomWinner
    ? myName
    : isTopWinner
    ? rel.top?.fullName
    : isLeftWinner
    ? rel.left?.fullName
    : isRightWinner
    ? rel.right?.fullName
    : lastHandResult?.winnerName || 'Player';

  const totalWon =
    lastHandResult?.totalWon ?? ((room?.config?.baseStake || 1000) * 3);
  const winningRoundNumber =
    lastHandResult?.handNumber ?? room?.handNumber ?? 1;

  const [dismissWinnerBanner, setDismissWinnerBanner] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);

  useEffect(() => {
    setDismissWinnerBanner(false);
  }, [winnerSeatIndex, room?.handNumber]);

  // Ticker real-time untuk animasi dan hitung mundur timer giliran (turn countdown)
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (currentTurnSeat === null) return undefined;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [currentTurnSeat]);

  // Hitung sisa detik giliran pemain aktif
  const turnTimeData = useMemo(() => {
    if (currentTurnSeat === null) return { secondsLeft: 0, ratio: 1, isUrgent: false };
    const totalMs = Math.max(1000, Number(turnTimeoutSec) * 1000);
    const approxNow = nowMs + (serverClockOffsetMs || 0);
    const deadline = turnDeadlineAt || (nowMs + totalMs);
    const remMs = Math.max(0, deadline - approxNow);
    const sec = Math.max(0, Math.ceil(remMs / 1000));
    const ratio = Math.max(0, Math.min(1, remMs / totalMs));
    return {
      secondsLeft: sec,
      ratio,
      isUrgent: sec <= 5 && sec > 0,
    };
  }, [currentTurnSeat, turnDeadlineAt, turnTimeoutSec, serverClockOffsetMs, nowMs]);

  const handleTriggerCombo = (categoryKey) => {
    const info = combosInHand[categoryKey];
    if (!info || !info.moves || info.moves.length === 0) return;

    const currentIdx = comboCycleIndex[categoryKey] || 0;
    const chosenMove = info.moves[currentIdx % info.moves.length];
    setComboCycleIndex((prev) => ({
      ...prev,
      [categoryKey]: currentIdx + 1,
    }));

    if (onSelectCodes && chosenMove) {
      onSelectCodes(chosenMove);
      sfx?.playCardSnap?.();
      sfx?.triggerCardSnapHaptic?.(15);
    }
  };

  // Navigasi keyboard pada desktop (Space/Enter: Play, P: Pass, R: Reset, S: Sort)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.key === 'Enter' || e.key === ' ') && canPlay && !actionBusy) {
        e.preventDefault();
        onPlaySelected?.();
      } else if ((e.key === 'p' || e.key === 'P') && canPass && !actionBusy) {
        e.preventDefault();
        onPass?.();
      } else if ((e.key === 'r' || e.key === 'R') && !actionBusy) {
        e.preventDefault();
        if (onSelectCodes) onSelectCodes([]);
        if (onResetOrder) onResetOrder();
        sfx?.playCardSnap?.();
      } else if ((e.key === 's' || e.key === 'S') && !actionBusy) {
        e.preventDefault();
        if (onCycleSortMode) onCycleSortMode();
        else if (onAutoOrder) onAutoOrder();
        sfx?.playCardSnap?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canPlay,
    canPass,
    actionBusy,
    onPlaySelected,
    onPass,
    onSelectCodes,
    onResetOrder,
    onCycleSortMode,
    onAutoOrder,
    sfx,
  ]);

  const opponents = [
    { seat: rel.left, position: 'left' },
    { seat: rel.top, position: 'top' },
    { seat: rel.right, position: 'right' },
  ];

  // =========================================================================
  // 1. TAMPILAN KHUSUS MOBILE PORTRAIT (VERTIKAL)
  // Menyesuaikan desain meja oval hijau felt & lis kayu otentik dari mode landscape:
  // - Meja oval hijau felt dengan lis kayu tebal proporsional vertikal
  // - Top Header: Back (<) & Dropdown Menu (Pengaturan, Panduan, Keluar) di kiri, Info Room & Bet di kanan
  // - Lawan: Tiger di atas, Henry di kiri, Sophia di kanan (kipas kartu, avatar asli, chip)
  // - Tengah: Trick kartu yang dibanting dengan label kombinasi di bawahnya
  // - Kontrol Fleksibel: Dropdown Kombinasi (sesuai arahan), Reset & Sort di atas tombol PASS & PLAY
  // - Bawah: Kipas kartu pemain dengan Drag & Drop horizontal halus & profil foto asli pemain
  // =========================================================================
  if (isPortrait) {
    return (
      <div
        className="poker-table-zones is-portrait relative w-full h-full select-none overflow-hidden bg-[#04181d]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0a333a 0%, #031418 100%)',
        }}
      >
        {/* 1. Meja Oval Utama (Felt Teal dengan Wood Rail) Proporsional Vertikal */}
        <div className="absolute inset-x-2 top-[38px] bottom-[136px] rounded-[44px] border-[6px] border-[#5a3318] bg-gradient-to-b from-[#0b4e54] to-[#063337] shadow-[inset_0_0_24px_rgba(0,0,0,0.65),0_6px_18px_rgba(0,0,0,0.7)] pointer-events-none">
          <div className="absolute inset-1.5 rounded-[36px] border border-teal-300/25 pointer-events-none" />
        </div>

        {/* 2. Top Header Bar: Back & Dropdown Menu di Kiri, Info Room & Bet di Kanan */}
        <header className="absolute top-0 inset-x-0 h-[38px] flex items-center justify-between px-2.5 z-30 pointer-events-auto">
          <div className="flex items-center gap-1.5 relative">
            {/* Tombol Back Cepat */}
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="Kembali ke menu meja"
              className="w-8 h-8 rounded-full bg-[#382013] hover:bg-[#4d2c1a] border border-[#784826] text-amber-200 shadow-md flex items-center justify-center active:scale-95 transition"
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
            </button>

            {/* Tombol Fullscreen Layar Penuh (Hilangkan Address Bar Chrome Android) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk layar penuh (hilangkan URL bar)'}
              className="w-8 h-8 rounded-full bg-[#382013] hover:bg-[#4d2c1a] border border-[#784826] text-amber-200 shadow-md flex items-center justify-center active:scale-95 transition"
            >
              {isFullscreen ? (
                <FullscreenExitRoundedIcon sx={{ fontSize: 17 }} />
              ) : (
                <FullscreenRoundedIcon sx={{ fontSize: 17 }} />
              )}
            </button>

            {/* Dropdown Menu Pengaturan Meja */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileDropdownOpen((prev) => !prev)}
                aria-label="Buka menu pengaturan meja"
                aria-expanded={mobileDropdownOpen}
                className="h-8 px-2 rounded-lg bg-[#382013] hover:bg-[#4d2c1a] border border-[#784826] text-amber-200 text-xs font-bold flex items-center gap-1 shadow-md active:scale-95 transition"
              >
                <SettingsRoundedIcon sx={{ fontSize: 15 }} />
                <span>Menu</span>
                <span className="text-xs opacity-75">▾</span>
              </button>

              {mobileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMobileDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute top-9 left-0 z-50 min-w-[144px] rounded-xl border border-[#784826] bg-[#1a0f0a]/95 backdrop-blur-md shadow-2xl py-1 text-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileDropdownOpen(false);
                        onOpenSettings?.();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#382013] text-amber-200 flex items-center gap-2 transition"
                    >
                      <SettingsRoundedIcon sx={{ fontSize: 15 }} />
                      <span>Pengaturan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileDropdownOpen(false);
                        onOpenHelp?.();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#382013] text-amber-200 flex items-center gap-2 transition"
                    >
                      <HelpOutlineRoundedIcon sx={{ fontSize: 15 }} />
                      <span>Panduan Kartu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileDropdownOpen(false);
                        toggleFullscreen();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#382013] text-amber-200 flex items-center gap-2 transition"
                    >
                      {isFullscreen ? (
                        <FullscreenExitRoundedIcon sx={{ fontSize: 15 }} />
                      ) : (
                        <FullscreenRoundedIcon sx={{ fontSize: 15 }} />
                      )}
                      <span>{isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Full Screen)'}</span>
                    </button>
                    <div className="my-1 border-t border-[#784826]/40" />
                    <button
                      type="button"
                      onClick={() => {
                        setMobileDropdownOpen(false);
                        onOpenMenu?.();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-rose-950/60 text-rose-300 flex items-center gap-2 transition"
                    >
                      <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
                      <span>Menu / Keluar</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info Ronde, Room & Bet di Kanan Header */}
          <div className="rounded-lg border border-teal-500/40 bg-[#09353a]/90 px-2 py-0.5 text-right shadow-sm flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-xs leading-none">
              Ronde #{room?.handNumber || 1}
            </span>
            <span className="text-xs font-bold text-slate-300">Room: {room?.maxPlayers || 4}</span>
            <span className="text-xs font-black text-amber-300 flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span>{formatCompactChips(room?.config?.baseStake || 1000)}</span>
            </span>
          </div>
        </header>

        {/* Banner Layar Penuh Cepat (Hilangkan URL Address Bar di Chrome Android) */}
        {!isFullscreen && showFullscreenPrompt && (
          <div className="absolute top-[42px] left-1/2 -translate-x-1/2 z-35 flex items-center gap-1.5 bg-gradient-to-r from-[#2a170c]/95 via-[#1a0f0a]/95 to-[#2a170c]/95 border border-amber-400/80 rounded-full px-2.5 py-0.5 shadow-2xl backdrop-blur-md pointer-events-auto">
            <button
              type="button"
              onClick={() => toggleFullscreen()}
              className="flex items-center gap-1 text-xs font-black text-amber-300 hover:text-amber-200 active:scale-95 transition"
              aria-label="Aktifkan layar penuh untuk menghilangkan address bar browser"
            >
              <FullscreenRoundedIcon sx={{ fontSize: 16 }} className="text-amber-400 animate-pulse" />
              <span>Layar Penuh (Hilangkan URL Bar)</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullscreenPrompt(false);
              }}
              className="text-slate-400 hover:text-white text-xs font-bold px-1 rounded-full"
              aria-label="Tutup saran layar penuh"
            >
              ✕
            </button>
          </div>
        )}

        {/* 3. Posisi 3 Lawan di Sekitar Meja */}
        {/* Lawan Atas (Tiger) */}
        <div className="absolute top-[44px] left-1/2 -translate-x-1/2 z-25 pointer-events-auto">
          {renderOpponentPill(rel.top, currentTurnSeat, isTopWinner, turnTimeData)}
        </div>

        {/* Lawan Kiri (Henry) */}
        <div className="absolute top-[96px] left-1.5 z-25 pointer-events-auto">
          {renderOpponentPill(rel.left, currentTurnSeat, isLeftWinner, turnTimeData)}
        </div>

        {/* Lawan Kanan (Sophia) */}
        <div className="absolute top-[96px] right-1.5 z-25 pointer-events-auto">
          {renderOpponentPill(rel.right, currentTurnSeat, isRightWinner, turnTimeData)}
        </div>

        {/* 4. Area Tengah Meja: Trick Kartu & Label Kombinasi */}
        <section
          className="absolute top-[168px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center justify-center gap-1 pointer-events-none"
          aria-label="Zona kartu tengah dan pot"
        >
          {/* Banner Selebrasi Kemenangan Ronde */}
          {renderWinnerBanner({
            hasWinner,
            dismissWinnerBanner,
            onDismiss: () => setDismissWinnerBanner(true),
            isBottomWinner,
            winnerName,
            winningRoundNumber,
            totalWon,
          })}
          <div
            className="flex items-center justify-center -space-x-3.5 min-h-[62px] pointer-events-auto"
            role="group"
            aria-label="Kartu komunitas meja"
          >
            {boardCards.length > 0 ? (
              boardCards.map((c, idx) => (
                <div
                  key={c.code || idx}
                  className="transition-transform duration-200"
                  style={{
                    transform: `rotate(${(idx - (boardCards.length - 1) / 2) * 4}deg)`,
                  }}
                >
                  <PlayingCard
                    card={c}
                    size="md"
                    fourColor={fourColorDeck}
                    cardBackDesign={cardBackDesign}
                  />
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-teal-400/20 bg-teal-950/30 px-3 py-1.5 text-xs text-teal-300/60 font-bold">
                Menunggu Banting
              </div>
            )}
          </div>

          {currentPlay?.label && (
            <div className="rounded-full border border-teal-400/40 bg-slate-900/80 px-2.5 py-0.5 text-xs font-black text-amber-200 tracking-wider shadow-sm flex items-center gap-1 pointer-events-auto">
              <span>{currentPlay.label}</span>
            </div>
          )}
        </section>

        {/* 5. Panel Kontrol Aksi Vertikal: Dropdown Kombinasi, Reset/Sort, PASS & PLAY */}
        <div className="absolute bottom-[140px] inset-x-2.5 z-25 flex flex-col gap-1.5 pointer-events-auto">
          {/* Baris 1: Dropdown Kombinasi (Kiri) + Reset & Sort (Kanan) */}
          <div className="flex items-center justify-between gap-1.5">
            {/* Dropdown Pilihan Kombinasi */}
            <div className="relative">
              <button
                type="button"
                disabled={actionBusy || (combosInHand.detectedList || []).length === 0}
                onClick={() => setComboDropdownOpen((prev) => !prev)}
                aria-label="Pilih kombinasi kartu tangan"
                aria-expanded={comboDropdownOpen}
                className="h-[28px] px-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-teal-500/50 text-emerald-300 font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition disabled:opacity-50"
              >
                <span>🃏 Kombinasi ({(combosInHand.detectedList || []).length})</span>
                <span className="text-xs opacity-75">▾</span>
              </button>

              {comboDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setComboDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute bottom-8 left-0 z-50 min-w-[160px] rounded-xl border border-teal-500/60 bg-[#062429]/95 backdrop-blur-md shadow-2xl py-1 text-slate-200">
                    <div className="px-2.5 py-1 text-xs font-black text-slate-400 border-b border-teal-500/30">
                      Kombinasi Tersedia:
                    </div>
                    {(combosInHand.detectedList || []).map((item) => {
                      const info = combosInHand[item.key];
                      const isPlayable = isMyTurn && info && info.isValidToPlay;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setComboDropdownOpen(false);
                            handleTriggerCombo(item.key);
                          }}
                          className={`w-full px-2.5 py-1.5 text-left text-xs font-bold flex items-center justify-between transition ${
                            isPlayable
                              ? 'text-emerald-300 hover:bg-emerald-950/60'
                              : 'text-slate-300 hover:bg-slate-800/80'
                          }`}
                        >
                          <span>{item.label}</span>
                          {isPlayable && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm animate-pulse shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Kontrol Reset & Sort */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  if (onSelectCodes) onSelectCodes([]);
                  if (onResetOrder) onResetOrder();
                  sfx?.playCardSnap?.();
                }}
                className="h-[28px] px-2.5 rounded-lg border border-rose-600/50 bg-[#541616] hover:bg-[#6c1d1d] active:scale-95 text-white font-extrabold text-xs shadow-sm transition"
                aria-label="Kembalikan susunan kartu dan bersihkan pilihan"
              >
                Reset
              </button>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  if (onCycleSortMode) onCycleSortMode();
                  else if (onAutoOrder) onAutoOrder();
                  sfx?.playCardSnap?.();
                }}
                className="h-[28px] px-2.5 rounded-lg border border-rose-600/50 bg-[#541616] hover:bg-[#6c1d1d] active:scale-95 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1"
                aria-label="Urutkan kartu tangan"
              >
                <span>Sort</span>
                <span className="text-amber-300 font-bold">
                  ({sortMode === 'rank' ? 'Rank' : sortMode === 'suit' ? 'Suit' : 'Auto'})
                </span>
              </button>
            </div>
          </div>

          {/* Sisa Waktu Giliran Anda saat Bertindak */}
          {isMyTurn && (
            <div
              className={`h-[24px] px-2.5 rounded-lg border text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition ${
                turnTimeData.isUrgent
                  ? 'bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-400/50'
                  : 'bg-slate-900/95 border-amber-400/80 text-amber-300'
              }`}
            >
              <span>⏱</span>
              <span>{turnTimeData.isUrgent ? 'Cepat! Sisa ' : 'Giliran Anda: '}{turnTimeData.secondsLeft} dtk</span>
            </div>
          )}

          {/* Baris 2: Tombol Aksi PASS (Kiri) & PLAY (Kanan) Ergonomis untuk Jempol */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!canPass || actionBusy}
              onClick={onPass}
              className="h-[34px] flex-1 rounded-xl bg-[#7a1a1a] hover:bg-[#912020] active:scale-95 disabled:bg-slate-900/60 disabled:text-slate-600 disabled:border-slate-800 text-white font-black text-xs tracking-wider border-2 border-red-400/40 shadow-md flex items-center justify-center transition"
              aria-label="Lewati giliran ini (Pass)"
            >
              PASS
            </button>

            <button
              type="button"
              disabled={!canPlay || actionBusy}
              onClick={onPlaySelected}
              className="h-[34px] flex-1 rounded-xl bg-[#8e6e2b] hover:bg-[#a37f33] active:scale-95 disabled:bg-slate-900/60 disabled:text-slate-600 disabled:border-slate-800 text-white font-black text-xs tracking-wider border-2 border-amber-300/50 shadow-md flex items-center justify-center gap-1.5 transition"
              aria-label="Banting kartu yang dipilih (Play)"
            >
              <span>PLAY</span>
              {selectedCodes.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#4a360f] text-amber-200 text-xs font-black flex items-center justify-center border border-amber-300/50">
                  {selectedCodes.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 6. Kartu Tangan Pemain & Profil Pemain di Bawah Meja */}
        <section
          className="absolute bottom-1 inset-x-0 z-20 flex flex-col items-center justify-end pointer-events-none"
          aria-label="Zona kartu tangan pemain"
        >
          {/* Fan Kartu Tangan dengan Drag & Drop */}
          {displayCards.length > 0 && (
            <div
              className="pointer-events-auto w-full flex justify-center overflow-visible px-1"
              role="region"
              aria-label="Kartu tangan Anda"
            >
              <DraggableHand
                cards={displayCards}
                selectedCodes={selectedCodes}
                isLandscape={true}
                ultraCompact={true}
                fourColorDeck={fourColorDeck}
                cardBackDesign={cardBackDesign}
                onToggleCard={onToggleCard}
                reducedMotion={reducedMotion}
                handOverlapClass={
                  displayCards.length > 10
                    ? '-space-x-[22px] sm:-space-x-5'
                    : displayCards.length > 7
                    ? '-space-x-4.5 sm:-space-x-4'
                    : '-space-x-3.5'
                }
                activeAnimationStep={activeAnimationStep}
                sfx={sfx}
                orderedCards={orderedCards}
                dimmedCodes={dimmedCodes}
                comboLabel={comboLabel}
                onReorder={onReorder}
                onAutoOrder={onAutoOrder}
                onResetOrder={onResetOrder}
              />
            </div>
          )}

          {/* Profil Pemain (Bawah Tengah) */}
          <div
            className={`rounded-lg border px-2 py-0.5 flex items-center gap-1.5 shadow-md shrink-0 -mt-2 z-30 pointer-events-auto transition-all relative ${
              isBottomWinner
                ? 'border-amber-400 bg-gradient-to-r from-[#2a2408] via-[#09403b] to-[#2a2408] ring-4 ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.7)]'
                : isMyTurn
                ? turnTimeData.isUrgent
                  ? 'border-rose-400 bg-[#350d0d] ring-4 ring-rose-500/70 animate-pulse'
                  : 'border-amber-400 bg-[#084045] ring-2 ring-amber-400/50'
                : 'border-teal-500/50 bg-[#07363b]/90'
            }`}
          >
            {isBottomWinner && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-md animate-bounce">
                👑 JUARA
              </div>
            )}
            {/* Badge Timer Hitung Mundur Anda */}
            {!isBottomWinner && isMyTurn && (
              <div
                className={`absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.2 rounded-full border text-xs font-black shadow-lg flex items-center gap-1 ${
                  turnTimeData.isUrgent
                    ? 'bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-400/60'
                    : 'bg-[#062429]/95 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
                }`}
              >
                <span>⏱</span>
                <span>{turnTimeData.secondsLeft}s</span>
              </div>
            )}
            <div className="w-5 h-5 rounded-full overflow-hidden border border-amber-400/60 bg-amber-500/20 flex items-center justify-center shrink-0 shadow-sm relative">
              {myAvatarUrl ? (
                <img
                  src={getOptimizedImageUrl(myAvatarUrl, { width: 64, height: 64 })}
                  alt={myName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-xs font-black text-amber-300">
                  {(myName[0] || 'P').toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-left">
              <div className="text-xs font-black text-white leading-tight">
                {formatPlayerShortName(myName, { maxChars: 10 })}
              </div>
              <div className="text-xs font-extrabold text-amber-300 flex items-center gap-0.5 leading-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                <span>{formatCompactChips(myChips)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Aksesibilitas E2E Tester */}
        <div className="poker-zone-action sr-only" aria-hidden="true">
          <button type="button" onClick={onPass}>Lewat</button>
          <button type="button" onClick={onPlaySelected}>Banting</button>
        </div>
        <section className="sr-only" aria-label="Zona pemain lawan" aria-hidden="true">
          <div>{opponents.map((o, idx) => <span key={idx}>{o.seat?.fullName}</span>)}</div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // 2. TAMPILAN KHUSUS DESKTOP & TABLET (Tetap dipertahankan 100% tanpa ubahan)
  // =========================================================================
  if (isDesktop) {
    return (
      <div
        className="poker-table-zones is-landscape relative w-full h-full select-none overflow-hidden bg-[#04181d] flex flex-col justify-between"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0a333a 0%, #031418 100%)',
        }}
      >
        {/* Header Bar Desktop: Tombol Bulat Kiri (<, ⚙, ?) & Info Room / Bet Kanan */}
        <header className="flex items-center justify-between px-3 md:px-6 lg:px-8 pt-2 md:pt-4 pb-1 z-30 min-h-[44px]">
          <div className="flex items-center gap-2 md:gap-3">
            <IconButton
              onClick={onOpenMenu}
              aria-label="Kembali ke menu meja"
              className="!min-h-[44px] !min-w-[44px] !w-11 md:!w-12 !h-11 md:!h-12 !rounded-full !bg-[#382013] hover:!bg-[#4d2c1a] !border-2 !border-[#784826] !text-amber-200 shadow-md"
            >
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>

            <IconButton
              onClick={onOpenSettings}
              aria-label="Buka pengaturan meja"
              className="!min-h-[44px] !min-w-[44px] !w-11 md:!w-12 !h-11 md:!h-12 !rounded-full !bg-[#382013] hover:!bg-[#4d2c1a] !border-2 !border-[#784826] !text-amber-200 shadow-md"
            >
              <SettingsRoundedIcon fontSize="small" />
            </IconButton>

            <IconButton
              onClick={onOpenHelp}
              aria-label="Bantuan dan aturan kombinasi"
              className="!min-h-[44px] !min-w-[44px] !w-11 md:!w-12 !h-11 md:!h-12 !rounded-full !bg-[#382013] hover:!bg-[#4d2c1a] !border-2 !border-[#784826] !text-amber-200 shadow-md"
            >
              <HelpOutlineRoundedIcon fontSize="small" />
            </IconButton>

            <IconButton
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk layar penuh'}
              className="!min-h-[44px] !min-w-[44px] !w-11 md:!w-12 !h-11 md:!h-12 !rounded-full !bg-[#382013] hover:!bg-[#4d2c1a] !border-2 !border-[#784826] !text-amber-200 shadow-md"
            >
              {isFullscreen ? (
                <FullscreenExitRoundedIcon fontSize="small" />
              ) : (
                <FullscreenRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </div>

          <div className="rounded-xl border border-teal-500/40 bg-[#09353a]/90 px-3 md:px-4 py-1 md:py-1.5 text-right shadow-md flex items-center gap-3">
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-extrabold text-xs md:text-sm">
              Ronde #{room?.handNumber || 1}
            </div>
            <div className="text-left">
              <div className="text-xs md:text-sm font-bold text-slate-300">
                Room: {room?.maxPlayers || 4} Players
              </div>
              <div className="text-xs md:text-sm font-black text-amber-300 flex items-center gap-1">
                <span>Bet:</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm" />
                <span>{formatCompactChips(room?.config?.baseStake || 1000)}</span>
              </div>
            </div>
            <span
              className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 shadow-sm"
              role="status"
              aria-label="Terhubung"
            />
          </div>
        </header>

        {/* Meja Oval Utama Desktop */}
        <div className="relative flex-1 flex items-center justify-center px-4 md:px-8 min-h-0">
          <div className="w-[94%] max-w-[820px] md:max-w-[980px] lg:max-w-[1120px] xl:max-w-[1220px] h-[82%] max-h-[320px] md:max-h-[420px] lg:max-h-[480px] xl:max-h-[520px] rounded-[70px] sm:rounded-[90px] md:rounded-[120px] lg:rounded-[140px] border-[8px] sm:border-[10px] md:border-[14px] lg:border-[16px] border-[#5a3318] bg-gradient-to-b from-[#0b4e54] to-[#063337] shadow-[inset_0_0_40px_rgba(0,0,0,0.65),0_12px_32px_rgba(0,0,0,0.7)] relative flex items-center justify-center">
            <div className="absolute inset-2 sm:inset-3 md:inset-4 lg:inset-5 rounded-[60px] sm:rounded-[78px] md:rounded-[102px] lg:rounded-[120px] border border-teal-300/25 pointer-events-none" />

            <div className="absolute -top-7 md:-top-9 lg:-top-11 left-1/2 -translate-x-1/2 z-20">
              {renderOpponentPill(rel.top, currentTurnSeat, isTopWinner, turnTimeData)}
            </div>

            <div className="absolute top-1/2 -translate-y-1/2 -left-3 md:-left-6 lg:-left-8 z-20">
              {renderOpponentPill(rel.left, currentTurnSeat, isLeftWinner, turnTimeData)}
            </div>

            <div className="absolute top-1/2 -translate-y-1/2 -right-3 md:-right-6 lg:-right-8 z-20">
              {renderOpponentPill(rel.right, currentTurnSeat, isRightWinner, turnTimeData)}
            </div>

            <section
              className="flex flex-col items-center justify-center gap-1 md:gap-2 z-10"
              aria-label="Zona kartu tengah dan pot"
            >
              {/* Banner Selebrasi Kemenangan Ronde */}
              {renderWinnerBanner({
                hasWinner,
                dismissWinnerBanner,
                onDismiss: () => setDismissWinnerBanner(true),
                isBottomWinner,
                winnerName,
                winningRoundNumber,
                totalWon,
              })}
              <div
                className="flex items-center justify-center -space-x-4 md:-space-x-5 min-h-[70px] md:min-h-[96px]"
                role="group"
                aria-label="Kartu komunitas meja"
              >
                {boardCards.length > 0 ? (
                  boardCards.map((c, i) => (
                    <div
                      key={c.code || i}
                      className="shadow-xl rounded-lg overflow-hidden transform hover:-translate-y-1 transition duration-150"
                    >
                      <PlayingCard
                        card={c}
                        size={isDesktop ? 'md' : 'sm'}
                        fourColor={fourColorDeck}
                        cardBackDesign={cardBackDesign}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-teal-200/60 text-xs md:text-sm font-extrabold tracking-wider border border-teal-500/20 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-[#042429]/60">
                    {mustIncludeThreeDiamond ? 'Wajib 3♦' : 'Meja Siap'}
                  </div>
                )}
              </div>

              {currentPlay?.label && (
                <span className="text-xs md:text-sm font-black text-teal-100 uppercase tracking-widest px-2.5 md:px-3.5 py-0.5 md:py-1 rounded-md bg-[#032024]/80 border border-teal-400/30 shadow-inner">
                  {currentPlay.label}
                </span>
              )}
            </section>

            <div className="absolute left-6 md:left-10 lg:left-14 bottom-4 md:bottom-7 z-20">
              <Button
                variant="contained"
                disabled={!canPass || actionBusy}
                onClick={onPass}
                className="!min-h-[46px] md:!min-h-[52px] !min-w-[94px] md:!min-w-[124px] !rounded-xl !bg-[#7a1a1a] hover:!bg-[#912020] active:scale-95 disabled:!bg-slate-900/60 disabled:!text-slate-600 disabled:!border-slate-800 !text-white !font-black !text-sm md:!text-base !tracking-wider !border-2 !border-red-400/40 shadow-lg !normal-case"
                aria-label="Lewati giliran ini (Pass)"
              >
                PASS
              </Button>
            </div>

            <div className="absolute right-6 md:right-10 lg:right-14 bottom-4 md:bottom-7 z-20">
              <Button
                variant="contained"
                disabled={!canPlay || actionBusy}
                onClick={onPlaySelected}
                className="!min-h-[46px] md:!min-h-[52px] !min-w-[94px] md:!min-w-[124px] !rounded-xl !bg-[#8e6e2b] hover:!bg-[#a37f33] active:scale-95 disabled:!bg-slate-900/60 disabled:!text-slate-600 disabled:!border-slate-800 !text-white !font-black !text-sm md:!text-base !tracking-wider !border-2 !border-amber-300/50 shadow-lg !normal-case flex items-center justify-center gap-1.5"
                aria-label="Banting kartu yang dipilih (Play)"
              >
                <span>PLAY</span>
                {selectedCodes.length > 0 && (
                  <span className="w-5 md:w-6 h-5 md:h-6 rounded-full bg-[#4a360f] text-amber-200 text-xs md:text-sm font-black flex items-center justify-center border border-amber-300/50">
                    {selectedCodes.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Baris Bawah Desktop: Combo Filter (Kiri), Kartu Tangan Pemain (Tengah), Reset & Sort (Kanan) */}
        <div className="relative w-full px-2 md:px-6 pb-1.5 md:pb-3 flex items-end justify-between z-30 min-h-[100px] md:min-h-[130px]">
          <div className="flex flex-col gap-1 md:gap-1.5 shrink-0 z-20 pb-0.5 md:pb-1 max-h-[140px] md:max-h-[175px] overflow-y-auto pr-1">
            {(combosInHand.detectedList || []).map((item) => {
              const info = combosInHand[item.key] || item;
              const hasCombo = info && info.hasInHand;
              const isPlayable = isMyTurn && info && info.isValidToPlay;

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!hasCombo || actionBusy}
                  onClick={() => handleTriggerCombo(item.key)}
                  className={`min-h-[28px] md:min-h-[34px] min-w-[102px] md:min-w-[136px] px-2.5 md:px-3.5 py-0.5 rounded-full border text-xs md:text-sm font-bold flex items-center justify-between transition-all active:scale-95 shadow-sm ${
                    isPlayable
                      ? 'border-emerald-400/80 bg-slate-900/90 text-emerald-200 hover:bg-slate-800'
                      : 'border-slate-700 bg-slate-900/75 text-slate-300 hover:bg-slate-800'
                  }`}
                  aria-label={`Pilih kombinasi ${item.label}`}
                >
                  <span>{item.label}</span>
                  {isPlayable && (
                    <span
                      className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm animate-pulse ml-1.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <section
            className="flex-1 flex flex-col items-center justify-end px-1 overflow-visible relative min-w-0"
            aria-label="Zona kartu dan chip Anda"
          >
            {displayCards.length > 0 && (
              <div className="overflow-visible pb-1 md:pb-2">
                <DraggableHand
                  cards={displayCards}
                  selectedCodes={selectedCodes}
                  winningCodeSet={new Set()}
                  cardSize="md"
                  isLandscape={true}
                  ultraCompact={false}
                  fourColorDeck={fourColorDeck}
                  cardBackDesign={cardBackDesign}
                  onToggleCard={onToggleCard}
                  reducedMotion={reducedMotion}
                  handOverlapClass="-space-x-3.5 md:-space-x-2.5 lg:-space-x-2"
                  activeAnimationStep={activeAnimationStep}
                  sfx={sfx}
                  orderedCards={orderedCards}
                  dimmedCodes={dimmedCodes}
                  comboLabel={comboLabel}
                  onReorder={onReorder}
                  onAutoOrder={onAutoOrder}
                  onResetOrder={onResetOrder}
                />
              </div>
            )}

            <div
              className={`rounded-lg border px-2.5 md:px-3.5 py-0.5 md:py-1 flex items-center gap-2 md:gap-3 shadow-md shrink-0 transition-all relative ${
                isBottomWinner
                  ? 'border-amber-400 bg-gradient-to-r from-[#2a2408] via-[#09403b] to-[#2a2408] ring-4 ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.7)]'
                  : isMyTurn
                  ? turnTimeData.isUrgent
                    ? 'border-rose-400 bg-[#350d0d] ring-4 ring-rose-500/70 animate-pulse'
                    : 'border-amber-400 bg-[#084045] ring-2 ring-amber-400/50'
                  : 'border-teal-500/50 bg-[#07363b]/90'
              }`}
            >
              {isBottomWinner && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-md animate-bounce">
                  👑 JUARA
                </div>
              )}
              {/* Badge Timer Hitung Mundur Anda di Desktop */}
              {!isBottomWinner && isMyTurn && (
                <div
                  className={`absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 px-2.5 py-0.2 rounded-full border text-xs md:text-sm font-black shadow-lg flex items-center gap-1 ${
                    turnTimeData.isUrgent
                      ? 'bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-400/60'
                      : 'bg-[#062429]/95 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
                  }`}
                >
                  <span>⏱</span>
                  <span>{turnTimeData.secondsLeft}s</span>
                </div>
              )}
              <div className="w-6 md:w-7 h-6 md:h-7 rounded-full overflow-hidden border border-amber-400/60 bg-amber-500/20 flex items-center justify-center shrink-0 shadow-sm relative">
                {myAvatarUrl ? (
                  <img
                    src={getOptimizedImageUrl(myAvatarUrl, { width: 64, height: 64 })}
                    alt={myName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-xs md:text-sm font-black text-amber-300">
                    {(myName[0] || 'P').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="text-xs md:text-sm font-black text-white leading-tight">
                  {formatPlayerShortName(myName, { maxChars: 16 })}
                </div>
                <div className="text-xs md:text-sm font-extrabold text-amber-300 flex items-center gap-1 leading-tight">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <span>{formatCompactChips(myChips)}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-end gap-1.5 md:gap-2 shrink-0 z-20 pb-0.5 md:pb-1">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => {
                if (onSelectCodes) onSelectCodes([]);
                if (onResetOrder) onResetOrder();
                sfx?.playCardSnap?.();
              }}
              className="min-h-[44px] md:min-h-[48px] px-3 md:px-4 py-1 rounded-lg border border-rose-600/50 bg-[#541616] hover:bg-[#6c1d1d] active:scale-95 text-white font-extrabold text-xs md:text-sm shadow-md transition"
              aria-label="Kembalikan susunan kartu dan bersihkan pilihan"
            >
              Reset
            </button>

            <div className="flex flex-col items-center">
              <span className="text-xs md:text-sm font-black text-slate-300 tracking-tight pb-0.5">
                {sortMode === 'rank' ? 'Rank' : sortMode === 'suit' ? 'Suit' : 'Auto'}
              </span>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  if (onCycleSortMode) onCycleSortMode();
                  else if (onAutoOrder) onAutoOrder();
                  sfx?.playCardSnap?.();
                }}
                className="min-h-[44px] md:min-h-[48px] px-3.5 md:px-4.5 py-1 rounded-lg border border-rose-600/50 bg-[#541616] hover:bg-[#6c1d1d] active:scale-95 text-white font-extrabold text-xs md:text-sm shadow-md transition"
                aria-label="Urutkan kartu tangan"
              >
                Sort
              </button>
            </div>
          </div>
        </div>

        {/* Aksesibilitas E2E Tester */}
        <div className="poker-zone-action sr-only" aria-hidden="true">
          <button type="button" onClick={onPass}>Lewat</button>
          <button type="button" onClick={onPlaySelected}>Banting</button>
        </div>
        <section className="sr-only" aria-label="Zona pemain lawan" aria-hidden="true">
          <div>{opponents.map((o, idx) => <span key={idx}>{o.seat?.fullName}</span>)}</div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // 2. TAMPILAN KHUSUS MOBILE LANDSCAPE (Rapi, Terstruktur, Tanpa Tumpang Tindih)
  // =========================================================================
  return (
    <div
      className="poker-table-zones is-landscape relative w-full h-full select-none overflow-hidden bg-[#04181d]"
      style={{
        background: 'radial-gradient(circle at 50% 50%, #0a333a 0%, #031418 100%)',
      }}
    >
      {/* 1. Meja Oval Utama (Felt Teal dengan Wood Rail) Melingkupi Layar */}
      <div className="absolute inset-x-[7%] top-[34px] bottom-[46px] rounded-[75px] border-[8px] border-[#5a3318] bg-gradient-to-b from-[#0b4e54] to-[#063337] shadow-[inset_0_0_36px_rgba(0,0,0,0.65),0_8px_24px_rgba(0,0,0,0.7)] pointer-events-none">
        <div className="absolute inset-2 rounded-[65px] border border-teal-300/25 pointer-events-none" />
      </div>

      {/* 2. Top Header Bar: Tombol Back & Dropdown Pengaturan Ramping di Kiri, Room/Bet di Kanan */}
      <header className="absolute top-0 inset-x-0 h-[40px] flex items-center justify-between px-2.5 z-30 pointer-events-auto">
        <div className="flex items-center gap-1.5 relative">
          {/* Tombol Back Cepat (Ramping) */}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Kembali ke menu meja"
            className="w-8 h-8 rounded-full bg-[#382013] hover:bg-[#4d2c1a] border border-[#784826] text-amber-200 shadow-md flex items-center justify-center active:scale-95 transition"
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
          </button>

          {/* Tombol Fullscreen Layar Penuh (Hilangkan Address Bar Chrome Android) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Masuk layar penuh (hilangkan URL bar)'}
            className="w-8 h-8 rounded-full bg-[#382013] hover:bg-[#4d2c1a] border border-[#784826] text-amber-200 shadow-md flex items-center justify-center active:scale-95 transition"
          >
            {isFullscreen ? (
              <FullscreenExitRoundedIcon sx={{ fontSize: 16 }} />
            ) : (
              <FullscreenRoundedIcon sx={{ fontSize: 16 }} />
            )}
          </button>

          {/* Dropdown Pengaturan Meja (Ringkas & Efisien) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMobileDropdownOpen((prev) => !prev)}
              aria-label="Buka menu pengaturan meja"
              aria-expanded={mobileDropdownOpen}
              className="h-8 px-2 rounded-lg bg-[#382013] hover:bg-[#4d2c1a] border border-[#784826] text-amber-200 text-xs font-bold flex items-center gap-1 shadow-md active:scale-95 transition"
            >
              <SettingsRoundedIcon sx={{ fontSize: 15 }} />
              <span>Menu</span>
              <span className="text-xs opacity-75">▾</span>
            </button>

            {/* Menu Dropdown Popup */}
            {mobileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMobileDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute top-9 left-0 z-50 min-w-[144px] rounded-xl border border-[#784826] bg-[#1a0f0a]/95 backdrop-blur-md shadow-2xl py-1 text-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDropdownOpen(false);
                      onOpenSettings?.();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#382013] text-amber-200 flex items-center gap-2 transition"
                  >
                    <SettingsRoundedIcon sx={{ fontSize: 15 }} />
                    <span>Pengaturan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDropdownOpen(false);
                      onOpenHelp?.();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#382013] text-amber-200 flex items-center gap-2 transition"
                  >
                    <HelpOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    <span>Panduan Kartu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDropdownOpen(false);
                      toggleFullscreen();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#382013] text-amber-200 flex items-center gap-2 transition"
                  >
                    {isFullscreen ? (
                      <FullscreenExitRoundedIcon sx={{ fontSize: 15 }} />
                    ) : (
                      <FullscreenRoundedIcon sx={{ fontSize: 15 }} />
                    )}
                    <span>{isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Full Screen)'}</span>
                  </button>
                  <div className="my-1 border-t border-[#784826]/40" />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDropdownOpen(false);
                      onOpenMenu?.();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-rose-950/60 text-rose-300 flex items-center gap-2 transition"
                  >
                    <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
                    <span>Menu / Keluar</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info Ronde, Room & Bet di Kanan Atas */}
        <div className="flex items-center gap-1.5">
          {/* Badge Ronde */}
          <div className="rounded-xl border border-amber-400/50 bg-[#241a0b]/90 px-2 py-0.5 text-center shadow-md flex items-center gap-1">
            <span className="text-xs font-black text-amber-300 tracking-wider">
              Ronde #{room?.handNumber || 1}
            </span>
          </div>

          <div className="rounded-xl border border-teal-500/40 bg-[#09353a]/90 px-2 py-0.5 text-right shadow-md flex items-center gap-2">
            <div className="text-left">
              <div className="text-xs font-bold text-slate-300 leading-tight">
                Room: {room?.maxPlayers || 4}
              </div>
              <div className="text-xs font-black text-amber-300 flex items-center gap-1 leading-tight">
                <span>Bet:</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-sm" />
                <span>{formatCompactChips(room?.config?.baseStake || 1000)}</span>
              </div>
            </div>
            <span
              className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-sm"
              role="status"
              aria-label="Terhubung"
            />
          </div>
        </div>
      </header>

      {/* Banner Layar Penuh Cepat (Hilangkan URL Address Bar di Chrome Android) */}
      {!isFullscreen && showFullscreenPrompt && (
        <div className="absolute top-[42px] left-1/2 -translate-x-1/2 z-35 flex items-center gap-1.5 bg-gradient-to-r from-[#2a170c]/95 via-[#1a0f0a]/95 to-[#2a170c]/95 border border-amber-400/80 rounded-full px-2.5 py-0.5 shadow-2xl backdrop-blur-md pointer-events-auto">
          <button
            type="button"
            onClick={() => toggleFullscreen()}
            className="flex items-center gap-1 text-xs font-black text-amber-300 hover:text-amber-200 active:scale-95 transition"
            aria-label="Aktifkan layar penuh untuk menghilangkan address bar browser"
          >
            <FullscreenRoundedIcon sx={{ fontSize: 16 }} className="text-amber-400 animate-pulse" />
            <span>Layar Penuh (Hilangkan URL Bar)</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullscreenPrompt(false);
            }}
            className="text-slate-400 hover:text-white text-xs font-bold px-1 rounded-full"
            aria-label="Tutup saran layar penuh"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Lawan Atas (Top Opponent: Tiger) di Atas Garis Meja */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-25 pointer-events-auto">
        {renderOpponentPill(rel.top, currentTurnSeat, isTopWinner, turnTimeData)}
      </div>

      {/* 4. Kolom Kiri: Henry di Atas & Combo Pills di Kiri Bawah (Leluasa Tanpa Tombol Pass) */}
      {/* Lawan Kiri (Henry) */}
      <div className="absolute top-[46px] left-3 z-25 pointer-events-auto">
        {renderOpponentPill(rel.left, currentTurnSeat, isLeftWinner, turnTimeData)}
      </div>

      {/* Combo Filter Pills di Kiri Bawah: Dijajar Rapi Ke Atas (1 Kolom Vertikal, Tidak Nabrak Kartu) */}
      <div
        className="absolute bottom-2 left-2 z-25 flex flex-col gap-1 max-h-[185px] overflow-y-auto pr-0.5 pointer-events-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {(combosInHand.detectedList || []).map((item) => {
          const info = combosInHand[item.key] || item;
          const hasCombo = info && info.hasInHand;
          const isPlayable = isMyTurn && info && info.isValidToPlay;

          return (
            <button
              key={item.key}
              type="button"
              disabled={!hasCombo || actionBusy}
              onClick={() => handleTriggerCombo(item.key)}
              className={`min-h-[24px] w-[92px] px-2 py-0.5 rounded-full border text-xs font-bold flex items-center justify-between transition-all active:scale-95 shadow-sm ${
                isPlayable
                  ? 'border-emerald-400/80 bg-slate-900/95 text-emerald-200 hover:bg-slate-800'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
              }`}
              aria-label={`Pilih kombinasi ${item.label}`}
            >
              <span className="truncate">{item.label}</span>
              {isPlayable && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm animate-pulse ml-1 shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 5. Kolom Kanan: Sophia di Atas, PLAY & PASS di Kanan, Reset & Sort di Bawah */}
      {/* Lawan Kanan (Sophia) */}
      <div className="absolute top-[46px] right-3 z-25 pointer-events-auto">
        {renderOpponentPill(rel.right, currentTurnSeat, isRightWinner, turnTimeData)}
      </div>

      {/* Tombol Aksi Kanan: PLAY di Atas & PASS di Bawah PLAY (Diturunkan agar tidak menabrak profil Sophia) */}
      <div className="absolute top-[132px] right-3 z-25 flex flex-col items-end gap-1.5 pointer-events-auto">
        {/* Timer Giliran Anda di Mobile Landscape */}
        {isMyTurn && (
          <div
            className={`h-[24px] min-w-[80px] px-2 rounded-lg border text-xs font-black shadow-md flex items-center justify-center gap-1 transition ${
              turnTimeData.isUrgent
                ? 'bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-400/50'
                : 'bg-slate-900/95 border-amber-400/80 text-amber-300'
            }`}
          >
            <span>⏱</span>
            <span>{turnTimeData.secondsLeft}s</span>
          </div>
        )}

        {/* Tombol PLAY (Emas - Diperkecil) */}
        <button
          type="button"
          disabled={!canPlay || actionBusy}
          onClick={onPlaySelected}
          className="h-[34px] min-w-[80px] px-3 rounded-xl bg-[#8e6e2b] hover:bg-[#a37f33] active:scale-95 disabled:bg-slate-900/60 disabled:text-slate-600 disabled:border-slate-800 text-white font-black text-xs tracking-wider border-2 border-amber-300/50 shadow-md flex items-center justify-center gap-1.5 transition"
          aria-label="Banting kartu yang dipilih (Play)"
        >
          <span>PLAY</span>
          {selectedCodes.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#4a360f] text-amber-200 text-xs font-black flex items-center justify-center border border-amber-300/50">
              {selectedCodes.length}
            </span>
          )}
        </button>

        {/* Tombol PASS (Merah - Di Bawah PLAY, Diperkecil) */}
        <button
          type="button"
          disabled={!canPass || actionBusy}
          onClick={onPass}
          className="h-[34px] min-w-[80px] px-3 rounded-xl bg-[#7a1a1a] hover:bg-[#912020] active:scale-95 disabled:bg-slate-900/60 disabled:text-slate-600 disabled:border-slate-800 text-white font-black text-xs tracking-wider border-2 border-red-400/40 shadow-md flex items-center justify-center transition"
          aria-label="Lewati giliran ini (Pass)"
        >
          PASS
        </button>
      </div>

      {/* Kontrol Reset & Sort di Kanan Bawah (Ukuran Diperkecil Ramping) */}
      <div className="absolute bottom-2 right-2.5 z-25 flex items-center gap-1.5 pointer-events-auto">
        <button
          type="button"
          disabled={actionBusy}
          onClick={() => {
            if (onSelectCodes) onSelectCodes([]);
            if (onResetOrder) onResetOrder();
            sfx?.playCardSnap?.();
          }}
          className="h-[28px] px-2.5 rounded-lg border border-rose-600/50 bg-[#541616] hover:bg-[#6c1d1d] active:scale-95 text-white font-extrabold text-xs shadow-sm transition"
          aria-label="Kembalikan susunan kartu dan bersihkan pilihan"
        >
          Reset
        </button>

        <button
          type="button"
          disabled={actionBusy}
          onClick={() => {
            if (onCycleSortMode) onCycleSortMode();
            else if (onAutoOrder) onAutoOrder();
            sfx?.playCardSnap?.();
          }}
          className="h-[28px] px-2.5 rounded-lg border border-rose-600/50 bg-[#541616] hover:bg-[#6c1d1d] active:scale-95 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1"
          aria-label="Urutkan kartu tangan"
        >
          <span>Sort</span>
          <span className="text-amber-300 font-bold">
            ({sortMode === 'rank' ? 'Rank' : sortMode === 'suit' ? 'Suit' : 'Auto'})
          </span>
        </button>
      </div>

      {/* 6. Area Tengah Meja: Trick Kartu & Label Kombinasi (Diturunkan agar tidak menabrak profil Tiger) */}
      <section
        className="absolute top-[96px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center justify-center gap-1 pointer-events-none"
        aria-label="Zona kartu tengah dan pot"
      >
        {/* Banner Selebrasi Kemenangan Ronde */}
        {renderWinnerBanner({
          hasWinner,
          dismissWinnerBanner,
          onDismiss: () => setDismissWinnerBanner(true),
          isBottomWinner,
          winnerName,
          winningRoundNumber,
          totalWon,
        })}

        <div
          className="flex items-center justify-center -space-x-4 min-h-[66px] pointer-events-auto"
          role="group"
          aria-label="Kartu komunitas meja"
        >
          {boardCards.length > 0 ? (
            boardCards.map((c, i) => (
              <div
                key={c.code || i}
                className="shadow-xl rounded-lg overflow-hidden transform hover:-translate-y-1 transition duration-150"
              >
                <PlayingCard
                  card={c}
                  size="sm"
                  fourColor={fourColorDeck}
                  cardBackDesign={cardBackDesign}
                />
              </div>
            ))
          ) : (
            <div className="text-teal-200/60 text-xs font-extrabold tracking-wider border border-teal-500/20 px-3 py-1 rounded-full bg-[#042429]/60">
              {mustIncludeThreeDiamond ? 'Wajib 3♦' : 'Meja Siap'}
            </div>
          )}
        </div>

        {currentPlay?.label && (
          <span className="text-xs font-black text-teal-100 uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#032024]/80 border border-teal-400/30 shadow-inner">
            {currentPlay.label}
          </span>
        )}
      </section>

      {/* 7. Bawah Tengah: Kartu Tangan Pemain & Profil Diri (Overlapping Rapi Sesuai Referensi) */}
      <section
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-22 flex flex-col items-center justify-end overflow-visible max-w-[calc(100%-216px)] pointer-events-auto"
        aria-label="Zona kartu dan chip Anda"
      >
        {displayCards.length > 0 && (
          <div className="overflow-visible pb-0.5">
            <DraggableHand
              cards={displayCards}
              selectedCodes={selectedCodes}
              winningCodeSet={new Set()}
              cardSize="sm"
              isLandscape={true}
              ultraCompact={false}
              fourColorDeck={fourColorDeck}
              cardBackDesign={cardBackDesign}
              onToggleCard={onToggleCard}
              reducedMotion={reducedMotion}
              handOverlapClass="-space-x-5 sm:-space-x-4.5"
              activeAnimationStep={activeAnimationStep}
              sfx={sfx}
              orderedCards={orderedCards}
              dimmedCodes={dimmedCodes}
              comboLabel={comboLabel}
              onReorder={onReorder}
              onAutoOrder={onAutoOrder}
              onResetOrder={onResetOrder}
            />
          </div>
        )}

        {/* Profil Pemain (Bawah Tengah) */}
        <div
          className={`rounded-lg border px-2 py-0.5 flex items-center gap-1.5 shadow-md shrink-0 -mt-2 z-30 transition-all relative ${
            isBottomWinner
              ? 'border-amber-400 bg-gradient-to-r from-[#2a2408] via-[#09403b] to-[#2a2408] ring-4 ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.7)]'
              : isMyTurn
              ? turnTimeData.isUrgent
                ? 'border-rose-400 bg-[#350d0d] ring-4 ring-rose-500/70 animate-pulse'
                : 'border-amber-400 bg-[#084045] ring-2 ring-amber-400/50'
              : 'border-teal-500/50 bg-[#07363b]/90'
          }`}
        >
          {isBottomWinner && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-md animate-bounce">
              👑 JUARA
            </div>
          )}
          {/* Badge Timer Hitung Mundur Anda di Mobile Landscape */}
          {!isBottomWinner && isMyTurn && (
            <div
              className={`absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.2 rounded-full border text-xs font-black shadow-lg flex items-center gap-1 ${
                turnTimeData.isUrgent
                  ? 'bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-400/60'
                  : 'bg-[#062429]/95 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
              }`}
            >
              <span>⏱</span>
              <span>{turnTimeData.secondsLeft}s</span>
            </div>
          )}
          <div className="w-5 h-5 rounded-full overflow-hidden border border-amber-400/60 bg-amber-500/20 flex items-center justify-center shrink-0 shadow-sm relative">
            {myAvatarUrl ? (
              <img
                src={getOptimizedImageUrl(myAvatarUrl, { width: 64, height: 64 })}
                alt={myName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="text-xs font-black text-amber-300">
                {(myName[0] || 'P').toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-left">
            <div className="text-xs font-black text-white leading-tight">
              {formatPlayerShortName(myName, { maxChars: 10 })}
            </div>
            <div className="text-xs font-extrabold text-amber-300 flex items-center gap-0.5 leading-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span>{formatCompactChips(myChips)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Aksesibilitas E2E Tester */}
      <div className="poker-zone-action sr-only" aria-hidden="true">
        <button type="button" onClick={onPass}>Lewat</button>
        <button type="button" onClick={onPlaySelected}>Banting</button>
      </div>
      <section className="sr-only" aria-label="Zona pemain lawan" aria-hidden="true">
        <div>{opponents.map((o, idx) => <span key={idx}>{o.seat?.fullName}</span>)}</div>
      </section>
    </div>
  );
}

/**
 * Render Pill Lawan dengan Grafis Kipas Kartu & Sisa Kartu + Mahkota & Efek Kemenangan
 */
function renderOpponentPill(seat, currentTurnSeat, isWinner = false, turnTimeData = null) {
  if (!seat) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 md:px-3 py-1 text-xs md:text-sm text-slate-400">
        Kursi Kosong
      </div>
    );
  }

  const isTurn = seat.seatIndex === currentTurnSeat;
  const cardCount = seat.cardCount !== undefined ? seat.cardCount : 12;
  const avatarUrl = seat.avatarUrl || seat.avatar_url;
  const name = seat.fullName || 'Player';
  const initial = seat.isBot ? '🤖' : (name[0] || 'L').toUpperCase();

  return (
    <div className="flex flex-col items-center relative">
      {/* Mahkota Juara Ronde */}
      {isWinner && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-md animate-bounce">
          👑 JUARA
        </div>
      )}

      {/* Badge Timer Hitung Mundur Lawan saat Giliran Aktif */}
      {!isWinner && isTurn && turnTimeData && (
        <div
          className={`absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.2 rounded-full border text-xs font-black shadow-lg flex items-center gap-1 ${
            turnTimeData.isUrgent
              ? 'bg-rose-950/95 border-rose-400 text-rose-200 animate-pulse ring-2 ring-rose-400/60'
              : 'bg-[#062429]/95 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
          }`}
        >
          <span>⏱</span>
          <span>{turnTimeData.secondsLeft}s</span>
        </div>
      )}

      {/* Grafis Kipas Kartu dengan Angka Sisa Kartu */}
      <div className="relative -mb-1 z-10 flex items-center justify-center">
        <div className="w-7 md:w-8 h-5 md:h-6 rounded-sm bg-blue-950 border border-blue-400 flex items-center justify-center shadow-md">
          <span className="text-xs md:text-sm font-black text-amber-200">
            {cardCount}
          </span>
        </div>
      </div>

      {/* Box Profil Lawan */}
      <div
        className={`rounded-lg px-2 md:px-3 py-0.5 md:py-1 flex items-center gap-1.5 md:gap-2 shadow-lg border transition-all ${
          isWinner
            ? 'border-amber-400 bg-gradient-to-r from-[#2a2408] via-[#09403b] to-[#2a2408] ring-4 ring-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.7)]'
            : isTurn
            ? turnTimeData?.isUrgent
              ? 'border-rose-400 bg-[#350d0d] ring-4 ring-rose-500/70 animate-pulse'
              : 'border-amber-400 bg-[#084045] ring-2 ring-amber-400/50 animate-pulse'
            : 'border-teal-500/40 bg-[#063034]'
        }`}
      >
        <div className="w-5 md:w-6 h-5 md:h-6 rounded-full overflow-hidden border border-teal-400/50 bg-teal-800/80 flex items-center justify-center shrink-0 shadow-sm relative">
          {avatarUrl ? (
            <img
              src={getOptimizedImageUrl(avatarUrl, { width: 64, height: 64 })}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs md:text-sm font-black text-teal-200">{initial}</span>
          )}
        </div>
        <div className="text-left">
          <div className="text-xs md:text-sm font-bold text-white truncate max-w-[80px] md:max-w-[120px] leading-tight">
            {formatPlayerShortName(name, { maxChars: 10 })}
          </div>
          <div className="text-xs md:text-sm font-black text-amber-300 flex items-center gap-0.5 leading-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            <span>{formatCompactChips(seat.chips)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner Selebrasi Kemenangan Ronde (Piala Emas & Partikel Cahaya)
 */
function renderWinnerBanner({
  hasWinner,
  dismissWinnerBanner,
  onDismiss,
  isBottomWinner,
  winnerName,
  winningRoundNumber,
  totalWon,
}) {
  if (!hasWinner || dismissWinnerBanner) return null;

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-auto flex flex-col items-center justify-center p-3.5 md:p-5 rounded-2xl border-2 border-amber-400 bg-[#062429]/95 backdrop-blur-md shadow-[0_0_40px_rgba(251,191,36,0.75)] text-center max-w-[270px] sm:max-w-[320px] md:max-w-[360px] animate-in fade-in zoom-in-95 duration-300 cursor-pointer"
      role="status"
      aria-live="assertive"
      onClick={onDismiss}
    >
      {/* Ikon Piala Emas & Partikel Cahaya */}
      <div className="relative mb-1 flex items-center justify-center">
        <span className="text-3xl md:text-4xl filter drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-bounce inline-block">
          🏆
        </span>
        <span className="absolute -top-1 -right-2 text-xs md:text-sm animate-ping">✨</span>
        <span className="absolute -bottom-1 -left-2 text-xs md:text-sm animate-pulse">⭐</span>
      </div>

      {/* Judul Pemenang */}
      <div className="text-base md:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 drop-shadow-sm leading-tight">
        {isBottomWinner
          ? 'SELAMAT, ANDA MENANG!'
          : `${formatPlayerShortName(winnerName, { maxChars: 12 })} MENANG!`}
      </div>

      {/* Info Ronde */}
      <div className="text-xs md:text-sm font-extrabold text-amber-300/90 mt-0.5">
        Juara Ronde #{winningRoundNumber}
      </div>

      {/* Badge Hadiah Chip */}
      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/60 shadow-inner">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-200 shadow-sm inline-block" />
        <span className="text-xs md:text-sm font-black text-emerald-300 font-mono">
          +{formatCompactChips(totalWon)} Chip
        </span>
      </div>

      <div className="mt-2 text-xs text-slate-400 font-medium">
        Ketuk untuk menutup
      </div>
    </div>
  );
}
