// FILE: client/src/pages/poker/PokerComponentPreviewPage.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PokerViewportShell from '../../components/poker/PokerViewportShell';
import PokerTable from '../../components/poker/PokerTable';
import ActionPanel from '../../components/poker/ActionPanel';
import LandscapeCapsaTable from '../../components/poker/LandscapeCapsaTable';
import FlyingTableOverlay from '../../components/poker/FlyingTableOverlay';
import PokerWaitingRoom from '../../components/poker/PokerWaitingRoom';
import PokerResultView from '../../components/poker/PokerResultView';
import useAnimationQueue from '../../hooks/useAnimationQueue';
import useHandOrdering from '../../hooks/useHandOrdering';
import {
  computeViewportLayoutMode,
  loadPokerPreferences,
  savePokerPreferences,
} from '../../utils/pokerUiHelpers';

const VIEWPORT_PRESETS = [
  { id: 'full', label: 'Otomatis (Viewport Nyata)', width: null, height: null },
  { id: '320', label: '320×568', width: 320, height: 568 },
  { id: '360', label: '360×640', width: 360, height: 640 },
  { id: '375', label: '375×667', width: 375, height: 667 },
  { id: '390', label: '390×844', width: 390, height: 844 },
  { id: '412', label: '412×915', width: 412, height: 915 },
  { id: '640_ls', label: '640×360 (L)', width: 640, height: 360 },
  { id: '844_ls', label: '844×390 (L)', width: 844, height: 390 },
  { id: '1024_tb', label: '1024×768 (Tablet)', width: 1024, height: 768 },
  { id: '1280_dt', label: '1280×800 (Desktop)', width: 1280, height: 800 },
];

const HOLDEM_HAND = [
  { rank: 14, suit: 'S', code: 'AS' },
  { rank: 14, suit: 'H', code: 'AH' },
];

const CAPSA_HAND = [
  { rank: 3, suit: 'D', code: '3D' },
  { rank: 5, suit: 'C', code: '5C' },
  { rank: 7, suit: 'H', code: '7H' },
  { rank: 9, suit: 'S', code: '9S' },
  { rank: 10, suit: 'D', code: '10D' },
  { rank: 11, suit: 'C', code: 'JC' },
  { rank: 12, suit: 'H', code: 'QH' },
  { rank: 13, suit: 'S', code: 'KS' },
  { rank: 14, suit: 'D', code: 'AD' },
  { rank: 14, suit: 'S', code: 'AS' },
  { rank: 2, suit: 'D', code: '2D' },
  { rank: 2, suit: 'H', code: '2H' },
  { rank: 2, suit: 'S', code: '2S' },
];

const COMMUNITY_CARDS = [
  { rank: 14, suit: 'S', code: 'AS' },
  { rank: 13, suit: 'S', code: 'KS' },
  { rank: 13, suit: 'D', code: 'KD' },
  { rank: 7, suit: 'H', code: '7H' },
  { rank: 2, suit: 'C', code: '2C' },
];

const buildSeatsForCase = (playerCount = 4, extremeCase = 'normal') => {
  const isLong = extremeCase === 'long';
  const isBig = extremeCase === 'bigchips';
  const base = [
    {
      seatIndex: 0,
      userId: 1,
      fullName: isLong ? 'Muhammad Raka Pratama Putra Wijaya' : 'Raka Putra',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      chips: isBig ? 12450000 : 1240,
      streetBet: isBig ? 250000 : 40,
      ready: true,
      connected: true,
      cardCount: 2,
    },
    {
      seatIndex: 1,
      userId: 2,
      fullName: isLong ? 'Christianus Bartholomew Putra' : 'Rani Kusuma',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      chips: isBig ? 8500000 : 980,
      folded: true,
      ready: true,
      connected: true,
      cardCount: 2,
    },
    {
      seatIndex: 2,
      userId: 3,
      fullName: isLong ? 'Siti Nurhaliza Kusumawati' : 'Dika Mahendra',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      chips: isBig ? 3200000 : 450,
      allIn: true,
      streetBet: isBig ? 120000 : 200,
      ready: true,
      connected: true,
      cardCount: 2,
    },
    {
      seatIndex: 3,
      userId: 4,
      fullName: isLong ? 'Dimas Anggara Ramadhan' : 'Nadia Putri',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
      chips: isBig ? 1950000 : 2150,
      isAway: true,
      ready: false,
      connected: false,
      cardCount: 2,
    },
  ];
  return base.slice(0, Math.min(4, Math.max(2, playerCount)));
};

export default function PokerComponentPreviewPage() {
  const [searchParams] = useSearchParams();
  const [preferences, setPreferences] = useState(() => loadPokerPreferences());
  const [screen, setScreen] = useState(() => searchParams.get('screen') || 'table');
  const [panelMode, setPanelMode] = useState(() => searchParams.get('mode') || 'holdem');
  const [viewportId, setViewportId] = useState('full');
  const [playerCount, setPlayerCount] = useState(() => Number(searchParams.get('players')) || 4);
  const [extremeCase, setExtremeCase] = useState(() => searchParams.get('edge') || 'normal');
  const [isMyTurn, setIsMyTurn] = useState(() => searchParams.get('turn') !== '0');
  const [raiseOpen, setRaiseOpen] = useState(() => searchParams.get('raise') === '1');
  const [joinOpen, setJoinOpen] = useState(() => searchParams.get('join') === '1');
  const [joinCode, setJoinCode] = useState('');
  const [devSheetOpen, setDevSheetOpen] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState(['AS', '2S']);
  const [betAmount, setBetAmount] = useState(120);
  const [realMetrics, setRealMetrics] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 360,
    height: typeof window !== 'undefined' ? window.innerHeight : 640,
  }));

  const animQueue = useAnimationQueue();
  const handOrder = useHandOrdering(panelMode === 'holdem' ? HOLDEM_HAND : CAPSA_HAND);

  useEffect(() => {
    const qScreen = searchParams.get('screen');
    const qMode = searchParams.get('mode');
    const qPlayers = searchParams.get('players');
    const qEdge = searchParams.get('edge');
    const qTurn = searchParams.get('turn');
    const qRaise = searchParams.get('raise');
    const qJoin = searchParams.get('join');

    if (qScreen) setScreen(qScreen);
    if (qMode) setPanelMode(qMode);
    if (qPlayers) setPlayerCount(Number(qPlayers) || 4);
    if (qEdge) setExtremeCase(qEdge);
    if (qTurn !== null) setIsMyTurn(qTurn !== '0');
    setRaiseOpen(qRaise === '1');
    setJoinOpen(qJoin === '1');
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      setRealMetrics({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const preset = VIEWPORT_PRESETS.find((p) => p.id === viewportId) || VIEWPORT_PRESETS[0];
  const activeW = preset.width || realMetrics.width;
  const activeH = preset.height || realMetrics.height;
  const layoutMode = computeViewportLayoutMode(activeW, activeH);
  const ultraCompact = Math.min(activeW, activeH) <= 340;
  const seats = buildSeatsForCase(playerCount, extremeCase);
  const potValue = extremeCase === 'bigchips' ? 1280000 : 1450;

  const updatePrefs = (partial) => {
    setPreferences(savePokerPreferences({ ...preferences, ...partial }));
  };

  const mockRoomState = {
    roomId: 'A7K9P2',
    room: {
      hostUserId: 1,
      winnerUserId: 1,
      handNumber: 3,
      phase: screen === 'waiting' ? 'lobby' : screen === 'result' ? 'selesai' : 'bermain',
      config: { startingChips: 1000, blindLevel: '10/20', baseStake: 10, turnTimeoutSec: 30 },
    },
    table: { seats },
  };

  const renderScreenContent = () => {
    if (screen === 'waiting') {
      return (
        <PokerWaitingRoom
          roomState={mockRoomState}
          currentUserId={1}
          socketStatus="connected"
          onToggleReady={() => {}}
          onStartGame={() => setScreen('table')}
          onKickPlayer={() => {}}
          onLeaveRoom={() => setScreen('lobby')}
        />
      );
    }

    if (screen === 'result') {
      return (
        <PokerResultView
          roomState={mockRoomState}
          onPlayAgain={() => setScreen('table')}
          onBackToLobby={() => setScreen('lobby')}
        />
      );
    }

    if (screen === 'lobby') {
      return (
        <PokerViewportShell
          theme={preferences.tableTheme}
          style={joinOpen ? { '--poker-keyboard-inset': '220px' } : undefined}
        >
          <header className="flex items-center justify-between px-1">
            <Button
              component={Link}
              to="/poker"
              variant="text"
              color="inherit"
              className="!min-h-[44px] poker-text-sm !normal-case"
            >
              Lobby Asli
            </Button>
            <h1 className="m-0 poker-text-md font-extrabold">Poker Kampus</h1>
            <IconButton
              onClick={() => setDevSheetOpen(true)}
              aria-label="Buka kontrol dev"
              className="!min-h-[44px] !min-w-[44px] !text-slate-200"
            >
              <MenuRoundedIcon fontSize="small" />
            </IconButton>
          </header>

          <div className="my-auto mx-auto w-full max-w-xs px-3 flex flex-col gap-3">
            <Button
              variant="contained"
              color="success"
              onClick={() => setScreen('waiting')}
              className="!min-h-[54px] !rounded-2xl !bg-emerald-600 !text-white !font-extrabold poker-text-md !normal-case !shadow-none"
            >
              Buat Room
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setJoinOpen(true)}
              className="!min-h-[54px] !rounded-2xl !border-slate-600 !text-slate-100 !font-extrabold poker-text-md !normal-case"
            >
              Gabung
            </Button>
          </div>

          <footer className="py-1 text-center">
            <p className="m-0 poker-text-sm text-slate-400">Chip virtual, tanpa uang asli</p>
          </footer>

          <Drawer
            anchor="bottom"
            open={joinOpen}
            onClose={() => setJoinOpen(false)}
            PaperProps={{
              className:
                '!mx-auto !w-full !max-w-md !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setJoinOpen(false);
                setScreen('waiting');
              }}
              className="p-4 space-y-3"
              style={{
                paddingBottom:
                  'calc(1rem + 220px * 0.4 + env(safe-area-inset-bottom))',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="poker-text-md font-extrabold">Gabung Room</span>
                <IconButton
                  onClick={() => setJoinOpen(false)}
                  aria-label="Tutup sheet gabung"
                  className="!min-h-[44px] !min-w-[44px] !text-slate-300"
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </div>
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))
                }
                placeholder="KODE 6 DIGIT"
                aria-label="Kode ID Room 6 karakter"
                className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-center font-mono poker-text-lg font-extrabold tracking-widest text-white"
              />
              <Button
                type="submit"
                variant="contained"
                color="success"
                fullWidth
                className="!min-h-[48px] !rounded-xl !bg-emerald-600 !text-white !font-extrabold poker-text-md !normal-case !shadow-none"
              >
                Masuk ke Meja
              </Button>
            </form>
          </Drawer>
        </PokerViewportShell>
      );
    }

    const isShowdown = screen === 'showdown';

    if (panelMode === 'capsa') {
      return (
        <PokerViewportShell theme={preferences.tableTheme}>
          <LandscapeCapsaTable
            seats={seats}
            viewerSeat={0}
            currentTurnSeat={isMyTurn ? 0 : 2}
            dealerSeat={0}
            sbSeat={1}
            bbSeat={2}
            starterSeat={null}
            winnerSeats={isShowdown ? [0] : []}
            lastHandResult={
              isShowdown
                ? {
                    winnerSeat: 0,
                    winnerName: seats[0]?.fullName || 'Player',
                    totalWon: 3000,
                    handNumber: 3,
                  }
                : null
            }
            room={{ maxPlayers: 4, handNumber: 3, config: { baseStake: 1000, turnTimeoutSec: 30 } }}
            turnDeadlineAt={Date.now() + 25000}
            turnTimeoutSec={30}
            serverClockOffsetMs={0}
            myHoleCards={handOrder.orderedCards}
            selectedCodes={selectedCodes}
            onToggleCard={(code) =>
              setSelectedCodes((prev) =>
                prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
              )
            }
            onSelectCodes={(codes) => setSelectedCodes(codes)}
            validActions={{
              canPlay: true,
              canPass: true,
              suggestedMoves: [
                { codes: ['3D'], label: 'Single 3♦', type: 'single' },
                { codes: ['2S'], label: 'Single 2♠', type: 'single' },
                { codes: ['5C', '5S'], label: 'Pair 5', type: 'pair' },
              ],
            }}
            actionBusy={false}
            onPlaySelected={() => setSelectedCodes([])}
            onPass={() => setIsMyTurn(false)}
            onAutoOrder={handOrder.handleAutoOrder}
            onResetOrder={handOrder.handleResetOrder}
            currentPlay={{ cards: COMMUNITY_CARDS.slice(0, 2), label: 'Single' }}
            mustIncludeThreeDiamond={false}
            fourColorDeck={preferences.fourColorDeck}
            cardBackDesign={preferences.cardBack}
            activeAnimationStep={animQueue.activeStep}
            reducedMotion={animQueue.reducedMotion}
            sfx={null}
            onOpenMenu={() => setDevSheetOpen(true)}
            onOpenSettings={() => setDevSheetOpen(true)}
            onOpenHelp={() => setDevSheetOpen(true)}
            sortMode="rank"
            orderedCards={handOrder.orderedCards}
            dimmedCodes={handOrder.dimmedCodes}
            comboLabel={handOrder.comboLabel}
            onReorder={handOrder.handleReorder}
            layoutMode={layoutMode}
          />

          <FlyingTableOverlay
            activeStep={animQueue.activeStep}
            animationSpeed={preferences.animationSpeed}
            reducedMotion={animQueue.reducedMotion}
            cardBackDesign={preferences.cardBack}
            fourColorDeck={Boolean(preferences.fourColorDeck)}
            onFastForward={animQueue.fastForwardAll}
          />
        </PokerViewportShell>
      );
    }

    return (
      <PokerViewportShell theme={preferences.tableTheme}>
        <div
          className={`poker-table-zones ${
            layoutMode === 'mobile_landscape' ? 'is-landscape' : ''
          }`}
        >
          <header className="flex items-center justify-between px-1 min-h-0">
            <IconButton
              onClick={() => setDevSheetOpen(true)}
              aria-label="Buka menu dan penguji layar"
              className="!min-h-[44px] !min-w-[44px] !text-slate-200"
            >
              <MenuRoundedIcon fontSize="small" />
            </IconButton>
            <span className="poker-text-sm font-bold poker-tabular text-slate-300 truncate">
              Ronde #3 · {activeW}×{activeH}
            </span>
            <span
              className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 mr-2"
              role="status"
              aria-label="Terhubung"
            />
          </header>

          <PokerTable
            theme={preferences.tableTheme}
            cardBackDesign={preferences.cardBack}
            fourColorDeck={preferences.fourColorDeck}
            layoutMode={layoutMode}
            ultraCompact={ultraCompact}
            seats={seats}
            viewerSeat={0}
            currentTurnSeat={isMyTurn ? 0 : 2}
            dealerSeat={0}
            sbSeat={1}
            bbSeat={2}
            winnerSeats={isShowdown ? [0] : []}
            timerPreviewProgress={0.72}
            totalPot={potValue}
            communityCards={COMMUNITY_CARDS.slice(0, 3)}
            myHoleCards={handOrder.orderedCards}
            selectedCodes={selectedCodes}
            onToggleCard={(code) =>
              setSelectedCodes((prev) =>
                prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
              )
            }
            activeAnimationStep={animQueue.activeStep}
            reducedMotion={animQueue.reducedMotion}
            orderedCards={handOrder.orderedCards}
            dimmedCodes={handOrder.dimmedCodes}
            comboLabel={handOrder.comboLabel}
            onReorder={handOrder.handleReorder}
            onAutoOrder={handOrder.handleAutoOrder}
            onResetOrder={handOrder.handleResetOrder}
            showdownState={
              isShowdown
                ? {
                    open: true,
                    winnerName: seats[0].fullName,
                    handName: 'Full House',
                    potAwarded: potValue,
                    cards: COMMUNITY_CARDS,
                    winningCardCodes: ['AS', 'KS', 'KD'],
                  }
                : null
            }
            onDismissShowdown={() => setScreen('table')}
          />

          <FlyingTableOverlay
            activeStep={animQueue.activeStep}
            animationSpeed={preferences.animationSpeed}
            reducedMotion={animQueue.reducedMotion}
            cardBackDesign={preferences.cardBack}
            fourColorDeck={Boolean(preferences.fourColorDeck)}
            onFastForward={animQueue.fastForwardAll}
          />

          <div className="poker-zone-action min-h-0">
            <ActionPanel
              mode={panelMode}
              layoutMode={layoutMode}
              isMyTurn={isMyTurn}
              phase="bermain"
              activeTurnName={seats[1]?.fullName || 'Rani'}
              selectedCodes={selectedCodes}
              validActions={{ canPlay: true, canPass: true, suggestedMoves: [{ codes: ['3D'] }] }}
              onAutoOrder={handOrder.handleAutoOrder}
              onResetOrder={handOrder.handleResetOrder}
              autoOrderLabel={handOrder.comboLabel}
              holdemState={{
                canFold: true,
                canCheck: false,
                canCall: true,
                callAmount: 40,
                canBet: true,
                canRaise: true,
                minBetOrRaiseTo: 80,
                maxBetOrRaiseTo: seats[0].chips,
                totalPot: potValue,
                step: 10,
              }}
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              raiseSheetOpen={raiseOpen}
              onRaiseSheetOpenChange={setRaiseOpen}
              onPlaySelected={() => setSelectedCodes([])}
              onPass={() => setIsMyTurn(false)}
              onHint={() => setSelectedCodes(['3D', '2S'])}
              onFold={() => setIsMyTurn(false)}
              onCall={() => setIsMyTurn(false)}
              onBetOrRaise={() => setIsMyTurn(false)}
            />
          </div>
        </div>
      </PokerViewportShell>
    );
  };

  return (
    <div className="h-dvh w-full bg-[#060a0c] flex items-center justify-center overflow-hidden relative">
      <div
        className="relative overflow-hidden"
        style={
          preset.width
            ? {
                width: `${preset.width}px`,
                height: `${preset.height}px`,
                border: '1px solid #334155',
              }
            : { width: '100%', height: '100%' }
        }
      >
        {renderScreenContent()}
      </div>

      {/* Tombol Dev Kontrol Melayang Aman (untuk halaman waiting/result yang tidak memiliki header dev) */}
      {(screen === 'waiting' || screen === 'result') && (
        <IconButton
          onClick={() => setDevSheetOpen(true)}
          aria-label="Buka panel penguji layar"
          className="!fixed !bottom-16 !right-3 !z-40 !min-h-[44px] !min-w-[44px] !bg-slate-800/90 !text-amber-300 !border !border-slate-600"
        >
          <TuneRoundedIcon fontSize="small" />
        </IconButton>
      )}

      {/* Drawer Penguji Multi-Layar & Kasus Ekstrem */}
      <Drawer
        anchor="bottom"
        open={devSheetOpen}
        onClose={() => setDevSheetOpen(false)}
        PaperProps={{
          className:
            '!mx-auto !w-full !max-w-lg !rounded-t-2xl !border-t !border-slate-700 !bg-[#131d22] !text-slate-100 !max-h-[85dvh]',
        }}
      >
        <div className="p-4 space-y-3 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="poker-text-md font-extrabold">Penguji Layar Poker Mobile</span>
            <IconButton
              onClick={() => setDevSheetOpen(false)}
              aria-label="Tutup panel penguji"
              className="!min-h-[44px] !min-w-[44px] !text-slate-300"
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <div className="space-y-1">
            <span className="poker-text-sm text-slate-400">Pilih Layar</span>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: 'lobby', label: 'Lobby' },
                { id: 'waiting', label: 'Tunggu' },
                { id: 'table', label: 'Meja' },
                { id: 'showdown', label: 'Menang' },
                { id: 'result', label: 'Hasil' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setScreen(s.id);
                    setDevSheetOpen(false);
                  }}
                  className={`min-h-[44px] rounded-xl border poker-text-sm font-bold ${
                    screen === s.id
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="poker-text-sm text-slate-400">Simulasi Viewport</span>
            <div className="grid grid-cols-4 gap-1">
              {VIEWPORT_PRESETS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewportId(v.id)}
                  className={`min-h-[44px] rounded-xl border px-1 poker-text-sm font-bold ${
                    viewportId === v.id
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-700 text-slate-300'
                  }`}
                >
                  {v.id === 'full' ? 'Nyata' : v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setPanelMode((m) => (m === 'holdem' ? 'capsa' : 'holdem'))}
              className="!min-h-[44px] !rounded-xl !border-slate-600 poker-text-sm !normal-case"
            >
              Mode: {panelMode}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setPlayerCount((c) => (c >= 4 ? 2 : c + 1))}
              className="!min-h-[44px] !rounded-xl !border-slate-600 poker-text-sm !normal-case"
            >
              Pemain: {playerCount}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() =>
                setExtremeCase((c) =>
                  c === 'normal' ? 'long' : c === 'long' ? 'bigchips' : 'normal'
                )
              }
              className="!min-h-[44px] !rounded-xl !border-slate-600 poker-text-sm !normal-case"
            >
              Kasus: {extremeCase}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                setScreen('table');
                setPanelMode('holdem');
                setIsMyTurn(true);
                setRaiseOpen(true);
                setDevSheetOpen(false);
              }}
              className="!min-h-[44px] !rounded-xl poker-text-sm !normal-case"
            >
              Buka Raise Sheet
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="poker-text-sm font-bold">Giliran Saya</span>
            <Switch
              color="success"
              checked={isMyTurn}
              onChange={(e) => setIsMyTurn(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="poker-text-sm font-bold">Dek 4-Warna</span>
            <Switch
              color="success"
              checked={preferences.fourColorDeck}
              onChange={(e) => updatePrefs({ fourColorDeck: e.target.checked })}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
