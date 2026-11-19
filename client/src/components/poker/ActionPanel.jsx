// FILE: client/src/components/poker/ActionPanel.jsx
import { useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import BetSlider from './BetSlider';
import {
  clampBetAmount,
  computeBetSliderBounds,
  formatCompactChips,
  formatPlayerShortName,
  resolvePreActionTrigger,
} from '../../utils/pokerUiHelpers';

/**
 * Professional Minimalist Action Panel (Zona 5):
 * - Portrait: 3 balanced thumb buttons at bottom (Lewat | Saran | Banting, or Fold | Check/Call | Raise).
 * - Landscape: Vertical command dock on the right side (never shrinks below >=44px touch target).
 * - When !isMyTurn: renders ONE calm status pill ("Menunggu Rani…").
 */
export default function ActionPanel({
  mode = 'capsa',
  layoutMode = 'mobile_portrait',
  validActions = {},
  isMyTurn = false,
  phase = 'bermain',
  activeTurnName = '',
  actionBusy = false,
  selectedCodes = [],
  onPlaySelected,
  onPass,
  onHint,
  holdemState = null,
  betAmount,
  onBetAmountChange,
  onFold,
  onCheck,
  onCall,
  onBetOrRaise,
  onAllIn,
  raiseSheetOpen: controlledRaiseOpen,
  onRaiseSheetOpenChange,
  preAction: controlledPreAction,
  onPreActionChange,
  onAutoOrder = null,
  onResetOrder = null,
  autoOrderLabel = '',
}) {
  const isLandscape = layoutMode === 'mobile_landscape';
  const [internalRaiseOpen, setInternalRaiseOpen] = useState(false);
  const [internalPreAction, setInternalPreAction] = useState(null);

  const raiseOpen =
    controlledRaiseOpen !== undefined ? Boolean(controlledRaiseOpen) : internalRaiseOpen;

  const setRaiseOpen = (next) => {
    if (controlledRaiseOpen === undefined) {
      setInternalRaiseOpen(Boolean(next));
    }
    onRaiseSheetOpenChange?.(Boolean(next));
  };

  const preActionValue =
    controlledPreAction !== undefined ? controlledPreAction : internalPreAction;

  const updatePreAction = (nextVal) => {
    if (controlledPreAction === undefined) {
      setInternalPreAction(nextVal);
    }
    onPreActionChange?.(nextVal);
  };

  const safeHoldem = holdemState || {};
  const canFold = Boolean(mode === 'holdem' && isMyTurn && safeHoldem.canFold !== false);
  const canCheck = Boolean(mode === 'holdem' && isMyTurn && safeHoldem.canCheck);
  const callAmount = Math.max(0, Number(safeHoldem.callAmount) || 0);
  const canCall = Boolean(mode === 'holdem' && isMyTurn && safeHoldem.canCall && callAmount > 0);
  const allInTarget = Math.max(
    0,
    Number(safeHoldem.maxBetOrRaiseTo ?? safeHoldem.playerChips ?? 1000) || 0
  );
  const canBetOrRaise = Boolean(
    mode === 'holdem' &&
      isMyTurn &&
      (safeHoldem.canBet || safeHoldem.canRaise !== false) &&
      allInTarget > 0
  );

  const sliderBounds = computeBetSliderBounds({
    minBetOrRaiseTo: safeHoldem.minBetOrRaiseTo || 20,
    maxBetOrRaiseTo: allInTarget,
    callAmount,
    totalPot: safeHoldem.totalPot || 0,
    step: safeHoldem.step || 5,
  });

  const [internalBet, setInternalBet] = useState(sliderBounds.min);

  useEffect(() => {
    setInternalBet((prev) => clampBetAmount(prev, sliderBounds.min, sliderBounds.max));
  }, [sliderBounds.min, sliderBounds.max]);

  const effectiveBet = clampBetAmount(
    betAmount !== undefined && betAmount !== null ? betAmount : internalBet,
    sliderBounds.min,
    sliderBounds.max
  );

  const handleBetSliderChange = (nextVal) => {
    const clamped = clampBetAmount(nextVal, sliderBounds.min, sliderBounds.max);
    if (betAmount === undefined || betAmount === null) {
      setInternalBet(clamped);
    }
    onBetAmountChange?.(clamped);
  };

  const prevTurnRef = useRef(isMyTurn);
  useEffect(() => {
    const wasMyTurn = prevTurnRef.current;
    prevTurnRef.current = isMyTurn;

    if (!wasMyTurn && isMyTurn && !actionBusy && preActionValue) {
      const resolution = resolvePreActionTrigger({
        preAction: preActionValue,
        isMyTurn: true,
        canCheck: Boolean(safeHoldem.canCheck),
        canPass: Boolean(validActions?.canPass),
      });
      updatePreAction(resolution.nextPreAction);
      if (resolution.shouldFire) {
        if (resolution.actionToRun === 'pass') onPass?.();
        else if (resolution.actionToRun === 'check') onCheck?.();
        else if (resolution.actionToRun === 'fold') onFold?.();
      }
    }
  }, [isMyTurn, actionBusy, preActionValue, safeHoldem.canCheck, validActions?.canPass]);

  const canPass = Boolean(mode === 'capsa' && isMyTurn && validActions?.canPass);
  const canPlay = Boolean(
    mode === 'capsa' && isMyTurn && selectedCodes.length > 0 && validActions?.canPlay
  );
  const canHint = Boolean(
    mode === 'capsa' && isMyTurn && validActions?.suggestedMoves?.length > 0
  );

  const handleConfirmRaiseSheet = (amount, isAllIn) => {
    setRaiseOpen(false);
    if (isAllIn && onAllIn) {
      onAllIn(amount);
    } else {
      onBetOrRaise?.(amount);
    }
  };

  const waitingText =
    phase === 'antar_tangan'
      ? 'Menyiapkan ronde berikutnya…'
      : activeTurnName
      ? `Menunggu ${formatPlayerShortName(activeTurnName, { maxChars: 14 })}…`
      : 'Menunggu giliran…';

  // Komponen tombol profesional Lewat, Saran, dan Banting
  const passButton = (
    <Button
      key="pass"
      variant="outlined"
      color="inherit"
      disabled={!canPass || actionBusy}
      onClick={onPass}
      className={`!min-h-[48px] !rounded-xl !border !border-slate-600/70 !bg-slate-800/90 hover:!bg-slate-700/90 active:!bg-slate-800 disabled:!border-slate-800/60 disabled:!bg-slate-900/40 disabled:!text-slate-500 !text-slate-100 !font-bold poker-text-md !normal-case !px-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm ${
        isLandscape ? 'flex-1 max-h-[58px]' : ''
      }`}
    >
      <SkipNextRoundedIcon sx={{ fontSize: 18 }} aria-hidden="true" />
      <span>Lewat</span>
    </Button>
  );

  const hintCount = validActions?.suggestedMoves?.length || 0;
  const hintButton = (
    <Button
      key="hint"
      variant="outlined"
      color="warning"
      disabled={!canHint || actionBusy}
      onClick={onHint}
      className={`!min-h-[48px] !rounded-xl !border !border-amber-400/50 !bg-amber-500/15 hover:!bg-amber-500/25 active:!bg-amber-500/20 disabled:!border-slate-800/60 disabled:!bg-slate-900/40 disabled:!text-slate-500 !text-amber-200 !font-bold poker-text-md !normal-case !px-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm ${
        isLandscape ? 'flex-1 max-h-[58px]' : ''
      }`}
    >
      <LightbulbOutlinedIcon sx={{ fontSize: 17 }} aria-hidden="true" />
      <span>Saran</span>
      {canHint && hintCount > 1 && (
        <span className="ml-0.5 rounded-md bg-amber-400/25 px-1.5 py-0.2 poker-text-sm font-black poker-tabular text-amber-200">
          {hintCount}
        </span>
      )}
    </Button>
  );

  const playButton = (
    <Button
      key="play"
      variant="contained"
      color="success"
      disabled={!canPlay || actionBusy}
      onClick={onPlaySelected}
      className={`!min-h-[48px] !rounded-xl !bg-emerald-600 hover:!bg-emerald-500 active:!bg-emerald-700 disabled:!border disabled:!border-slate-800/70 disabled:!bg-slate-800/60 disabled:!text-slate-400 !border !border-emerald-400/40 !text-white !font-black poker-text-md poker-tabular !normal-case !shadow-md !shadow-emerald-950/40 !px-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
        isLandscape ? 'flex-1 max-h-[58px]' : ''
      }`}
    >
      <SendRoundedIcon sx={{ fontSize: 16 }} aria-hidden="true" />
      <span>Banting</span>
      {selectedCodes.length > 0 && (
        <span className="ml-0.5 rounded-md bg-emerald-950/75 border border-emerald-400/40 px-1.5 py-0.2 poker-text-sm font-black poker-tabular text-emerald-200">
          {selectedCodes.length}
        </span>
      )}
    </Button>
  );

  const orderButtonGroup = (onAutoOrder || onResetOrder) && (
    <div className="grid grid-cols-2 gap-1.5 w-full shrink-0">
      <Button
        variant="outlined"
        color="inherit"
        disabled={actionBusy || !onAutoOrder}
        onClick={onAutoOrder}
        className="!min-h-[44px] !rounded-xl !border !border-emerald-500/40 !bg-slate-800/80 hover:!bg-emerald-500/20 active:!bg-slate-800 !text-emerald-300 !font-bold poker-text-sm !normal-case flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-sm"
        aria-label="Urutkan kartu otomatis sesuai kombinasi terbaik"
      >
        <span>Urut{autoOrderLabel ? ` (${autoOrderLabel})` : ''}</span>
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        disabled={actionBusy || !onResetOrder}
        onClick={onResetOrder}
        className="!min-h-[44px] !rounded-xl !border !border-slate-700 !bg-slate-900/80 hover:!bg-slate-800 active:!bg-slate-900 !text-slate-400 hover:!text-slate-200 !font-bold poker-text-sm !normal-case flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-sm"
        aria-label="Kembalikan susunan kartu ke urutan semula"
      >
        <span>Reset</span>
      </Button>
    </div>
  );

  return (
    <>
      <div
        className={`poker-flat-panel w-full h-full flex items-center justify-center px-2 py-1.5 ${
          isMyTurn ? 'border-emerald-500/60' : ''
        }`}
      >
        {!isMyTurn ? (
          isLandscape ? (
            <div className="flex flex-col items-center justify-between text-center p-1.5 h-full w-full">
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500/60 animate-pulse" aria-hidden="true" />
                <p className="m-0 poker-text-md font-bold text-slate-300 line-clamp-2">
                  {waitingText}
                </p>
              </div>
              {mode === 'capsa' && orderButtonGroup}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full bg-slate-500/60 animate-pulse" aria-hidden="true" />
              <p className="m-0 poker-text-md font-bold text-slate-300 truncate">
                {waitingText}
              </p>
            </div>
          )
        ) : mode === 'holdem' ? (
          <div
            className={`w-full ${
              isLandscape ? 'flex flex-col justify-between gap-2 h-full py-1' : 'grid grid-cols-3 gap-2'
            }`}
          >
            <Button
              variant="outlined"
              color="error"
              disabled={!canFold || actionBusy}
              onClick={onFold}
              className={`!min-h-[48px] !rounded-xl !border-rose-500/50 !bg-rose-500/10 !text-rose-200 !font-bold poker-text-md !normal-case ${
                isLandscape ? 'flex-1 max-h-[58px]' : ''
              }`}
            >
              Fold
            </Button>

            <Button
              variant="contained"
              color="success"
              disabled={(!canCheck && !canCall) || actionBusy}
              onClick={() => (canCall ? onCall?.() : onCheck?.())}
              className={`!min-h-[48px] !rounded-xl !bg-emerald-600 !text-white !font-extrabold poker-text-md poker-tabular !normal-case !shadow-none ${
                isLandscape ? 'flex-1 max-h-[58px]' : ''
              }`}
            >
              {canCall ? `Call ${formatCompactChips(callAmount)}` : 'Check'}
            </Button>

            <Button
              variant="outlined"
              color="warning"
              disabled={!canBetOrRaise || actionBusy}
              onClick={() => setRaiseOpen(true)}
              className={`!min-h-[48px] !rounded-xl !border-amber-400/70 !bg-amber-500/15 !text-amber-200 !font-extrabold poker-text-md !normal-case ${
                isLandscape ? 'flex-1 max-h-[58px]' : ''
              }`}
            >
              {callAmount > 0 ? 'Raise' : 'Bet'}
            </Button>
          </div>
        ) : (
          /* Capsa Banting: Di Landscape urutan atas->bawah (Banting, Saran, Lewat, [Urut/Reset]); di Portrait kiri->kanan (Lewat, Saran, Banting) */
          <div
            className={`w-full ${
              isLandscape ? 'flex flex-col justify-between gap-2 h-full py-1' : 'grid grid-cols-3 gap-2'
            }`}
          >
            {isLandscape ? (
              <>
                {playButton}
                {hintButton}
                {passButton}
                {orderButtonGroup}
              </>
            ) : (
              <>
                {passButton}
                {hintButton}
                {playButton}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sheet Raise: Slider + 3 Tombol Cepat (Min, ½ Pot, All-in) + 1 Tombol Konfirmasi */}
      <Drawer
        anchor="bottom"
        open={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        PaperProps={{
          className:
            '!mx-auto !w-full !max-w-md !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100',
        }}
      >
        <div className="p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="poker-text-md font-extrabold">
              {callAmount > 0 ? 'Atur Jumlah Raise' : 'Atur Jumlah Taruhan'}
            </span>
            <IconButton
              onClick={() => setRaiseOpen(false)}
              aria-label="Tutup sheet raise"
              className="!min-h-[44px] !min-w-[44px] !text-slate-300"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <BetSlider
            value={effectiveBet}
            onChange={handleBetSliderChange}
            onConfirm={handleConfirmRaiseSheet}
            minBetOrRaiseTo={safeHoldem.minBetOrRaiseTo || 20}
            maxBetOrRaiseTo={allInTarget}
            callAmount={callAmount}
            totalPot={safeHoldem.totalPot || 0}
            step={safeHoldem.step || 5}
            disabled={!canBetOrRaise || actionBusy}
            isRaise={callAmount > 0}
          />
        </div>
      </Drawer>
    </>
  );
}
