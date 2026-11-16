// FILE: client/src/pages/poker/PokerRoomPage.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import useAuthStore from '../../store/useAuthStore';
import usePokerStore from '../../store/usePokerStore';
import { pokerSocket } from '../../utils/pokerSocketClient';
import { toast } from '../../store/useThemeStore';
import PokerWaitingRoom from '../../components/poker/PokerWaitingRoom';
import PokerTableView from '../../components/poker/PokerTableView';
import PokerResultView from '../../components/poker/PokerResultView';

export default function PokerRoomPage() {
  const { roomId: rawRoomId } = useParams();
  const roomId = String(rawRoomId || '').trim().toUpperCase();
  const navigate = useNavigate();

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
      <div className="mx-auto max-w-md py-8">
        <div className="card-surface p-6 text-center space-y-3">
          <ErrorOutlineRoundedIcon color="warning" sx={{ fontSize: 44 }} className="mx-auto" />
          <h2 className="m-0 text-lg font-extrabold text-slate-900 dark:text-white">
            Sesi Dibuka di Tab Lain
          </h2>
          <p className="m-0 text-sm text-slate-500 dark:text-slate-400">{replacedMessage}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button
              variant="contained"
              color="success"
              onClick={() => pokerSocket.connect()}
              className="!min-h-[44px]"
            >
              Ambil Alih di Tab Ini
            </Button>
            <Button component={Link} to="/poker" variant="outlined" className="!min-h-[44px]">
              Ke Lobby
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (kickedMessage || joinError) {
    return (
      <div className="mx-auto max-w-md py-8">
        <div className="card-surface p-6 text-center space-y-3">
          <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 44 }} className="mx-auto" />
          <h2 className="m-0 text-lg font-extrabold text-slate-900 dark:text-white">
            Tidak Dapat Berada di Meja
          </h2>
          <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
            {kickedMessage || joinError}
          </p>
          <Button
            component={Link}
            to="/poker"
            variant="contained"
            color="success"
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => clearRoomState()}
            className="!min-h-[44px]"
          >
            Kembali ke Lobby Poker
          </Button>
        </div>
      </div>
    );
  }

  if (booting || !roomState || roomState.roomId !== roomId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-4">
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={340} />
        <Skeleton variant="rounded" height={90} />
      </div>
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

  const phase = roomState.room?.phase;

  if (phase === 'selesai') {
    return (
      <PokerResultView
        roomState={roomState}
        onBackToLobby={() => {
          leaveRoom(roomId);
          navigate('/poker');
        }}
      />
    );
  }

  if (phase === 'lobby') {
    return (
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
    );
  }

  return (
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
  );
}
