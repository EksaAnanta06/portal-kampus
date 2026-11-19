// FILE: client/src/pages/poker/PokerRoomPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import useAuthStore from '../../store/useAuthStore';
import usePokerStore from '../../store/usePokerStore';
import { pokerSocket } from '../../utils/pokerSocketClient';
import { toast } from '../../store/useThemeStore';
import PokerViewportShell from '../../components/poker/PokerViewportShell';
import PokerWaitingRoom from '../../components/poker/PokerWaitingRoom';
import PokerTableView from '../../components/poker/PokerTableView';
import PokerResultView from '../../components/poker/PokerResultView';
import { loadPokerPreferences } from '../../utils/pokerUiHelpers';

export default function PokerRoomPage() {
  const { roomId: rawRoomId } = useParams();
  const roomId = String(rawRoomId || '').trim().toUpperCase();
  const navigate = useNavigate();
  const preferences = loadPokerPreferences();

  const user = useAuthStore((s) => s.user);
  const {
    socketStatus,
    roomState,
    serverClockOffsetMs,
    actionLog,
    seatReactions,
    fourColorDeck,
    soundEnabled,
    replacedMessage,
    kickedMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    kickPlayer,
    endRoom,
    sendGameAction,
    sendReaction,
    toggleFourColorDeck,
    toggleSoundEnabled,
    clearRoomState,
  } = usePokerStore();

  const [booting, setBooting] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const enterRoom = async () => {
      if (!roomId) {
        setJoinError('ID room tidak valid.');
        setBooting(false);
        return;
      }

      if (roomState?.roomId === roomId && socketStatus === 'connected') {
        setBooting(false);
        setJoinError(null);
        return;
      }

      setBooting(true);
      setJoinError(null);
      try {
        await joinRoom(roomId);
      } catch (err) {
        if (active) setJoinError(err.message || 'Gagal memasuki room.');
      } finally {
        if (active) setBooting(false);
      }
    };

    enterRoom();
    return () => {
      active = false;
    };
  }, [roomId, joinRoom, roomState?.roomId, socketStatus]);

  if (replacedMessage) {
    return (
      <PokerViewportShell theme={preferences.tableTheme}>
        <div className="m-auto w-full max-w-sm poker-flat-elevated p-5 text-center space-y-3">
          <h2 className="m-0 poker-text-md font-extrabold text-amber-400">
            Sesi Dibuka di Tab Lain
          </h2>
          <p className="m-0 poker-text-sm text-slate-300">{replacedMessage}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="contained"
              color="success"
              onClick={() => pokerSocket.connect()}
              className="!min-h-[44px] !rounded-xl !bg-emerald-600 !text-white poker-text-sm !font-bold !normal-case !shadow-none"
            >
              Ambil Alih
            </Button>
            <Button
              component={Link}
              to="/poker"
              variant="outlined"
              color="inherit"
              className="!min-h-[44px] !rounded-xl !border-slate-600 !text-slate-200 poker-text-sm !font-bold !normal-case"
            >
              Ke Lobby
            </Button>
          </div>
        </div>
      </PokerViewportShell>
    );
  }

  if (kickedMessage || joinError) {
    return (
      <PokerViewportShell theme={preferences.tableTheme}>
        <div className="m-auto w-full max-w-sm poker-flat-elevated p-5 text-center space-y-3">
          <h2 className="m-0 poker-text-md font-extrabold text-rose-400">
            Tidak Dapat Berada di Meja
          </h2>
          <p className="m-0 poker-text-sm text-slate-300">{kickedMessage || joinError}</p>
          <Button
            component={Link}
            to="/poker"
            variant="contained"
            color="success"
            fullWidth
            onClick={() => clearRoomState()}
            className="!min-h-[44px] !rounded-xl !bg-emerald-600 !text-white poker-text-sm !font-extrabold !normal-case !shadow-none"
          >
            Kembali ke Lobby
          </Button>
        </div>
      </PokerViewportShell>
    );
  }

  if (booting || !roomState || roomState.roomId !== roomId) {
    return (
      <PokerViewportShell theme={preferences.tableTheme}>
        <div className="my-auto mx-auto w-full max-w-md space-y-3 px-2">
          <Skeleton variant="rounded" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
          <Skeleton variant="rounded" height={220} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
          <Skeleton variant="rounded" height={56} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
        </div>
      </PokerViewportShell>
    );
  }

  const runBusy = async (fn) => {
    setActionBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err.message || 'Gagal memproses aksi.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeave = async () => {
    await runBusy(async () => {
      await leaveRoom(roomId);
      navigate('/poker');
    });
  };

  const handlePlayAgain = async () => {
    await runBusy(async () => {
      const prevConfig = roomState.room?.config || {};
      const hasBot = (roomState.table?.seats || []).some((s) => s.isBot);
      await leaveRoom(roomId);
      const nextState = await createRoom({
        startingChips: prevConfig.startingChips || 1000,
        blindLevel:
          prevConfig.blindLevel ||
          `${prevConfig.baseStake || 10}/${(prevConfig.baseStake || 10) * 2}`,
        turnTimeoutSec: prevConfig.turnTimeoutSec || 30,
        quickBotMode: hasBot,
      });
      navigate(`/poker/${nextState.roomId}`, { replace: true });
    });
  };

  const phase = roomState.room?.phase;

  if (phase === 'selesai') {
    return (
      <div key="phase-selesai" className="poker-page-transition h-full">
        <PokerResultView
          roomState={roomState}
          actionBusy={actionBusy}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleLeave}
        />
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div key="phase-lobby" className="poker-page-transition h-full">
        <PokerWaitingRoom
          roomState={roomState}
          currentUserId={user?.id}
          socketStatus={socketStatus}
          actionBusy={actionBusy}
          onToggleReady={(ready) => runBusy(() => setReady(roomId, ready))}
          onStartGame={() => runBusy(() => startGame(roomId))}
          onKickPlayer={(uid) => runBusy(() => kickPlayer(roomId, uid))}
          onLeaveRoom={handleLeave}
        />
      </div>
    );
  }

  return (
    <div key="phase-table" className="poker-page-transition h-full">
      <PokerTableView
        roomState={roomState}
        currentUserId={user?.id}
        currentUserRole={user?.role}
        socketStatus={socketStatus}
        serverClockOffsetMs={serverClockOffsetMs}
        actionLog={actionLog}
        seatReactions={seatReactions}
        fourColorDeck={fourColorDeck}
        soundEnabled={soundEnabled}
        actionBusy={actionBusy}
        onToggleFourColor={toggleFourColorDeck}
        onToggleSound={toggleSoundEnabled}
        onGameAction={(payload) => runBusy(() => sendGameAction(payload))}
        onSendReaction={(emote) => sendReaction(roomId, emote).catch((e) => toast.error(e.message))}
        onLeaveRoom={handleLeave}
        onEndRoom={() => runBusy(() => endRoom(roomId))}
        onKickPlayer={(uid) => runBusy(() => kickPlayer(roomId, uid))}
      />
    </div>
  );
}
