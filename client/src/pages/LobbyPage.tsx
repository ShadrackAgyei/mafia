import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socket';
import { useRoomStore } from '../stores/useRoomStore';
import { useGameStore } from '../stores/useGameStore';

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { room, yourPlayerId, isHost, setRoom, setYourPlayerId } = useRoomStore();

  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    const playerName = localStorage.getItem('playerName');

    if (!playerId || !playerName || !code) {
      navigate('/');
      return;
    }

    setYourPlayerId(playerId);
    const socket = socketService.connect();

    // Join lobby
    socketService.joinLobby({ roomCode: code, playerName, playerId });

    // Listen for events
    socket.on('lobby:joined', (data) => {
      setRoom(data.room);
    });

    socket.on('lobby:player_joined', (data) => {
      useRoomStore.getState().addPlayer(data.player);
    });

    socket.on('lobby:player_left', (data) => {
      useRoomStore.getState().removePlayer(data.playerId);
    });

    socket.on('game:started', (data) => {
      useGameStore.getState().setYourRole(data.yourRole);
      if (data.mafiaMembers) {
        useGameStore.getState().setMafiaMembers(data.mafiaMembers);
      }
      navigate(`/game/${code}`);
    });

    return () => {
      socket.off('lobby:joined');
      socket.off('lobby:player_joined');
      socket.off('lobby:player_left');
      socket.off('game:started');
    };
  }, [code, navigate]);

  const handleReady = () => {
    if (!code || !yourPlayerId) return;
    const isReady = room?.players.find((p) => p.id === yourPlayerId)?.isReady || false;
    socketService.toggleReady({ roomCode: code, ready: !isReady });
  };

  const handleStart = () => {
    if (!code) return;
    socketService.startGame({ roomCode: code });
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mafia-red mx-auto mb-4"></div>
          <p className="text-gray-400">Joining lobby...</p>
        </div>
      </div>
    );
  }

  const yourPlayer = room.players.find((p) => p.id === yourPlayerId);
  const allReady = room.players.every((p) => p.isReady);
  const canStart = room.players.length >= 5 && allReady && isHost;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Room: {code}</h1>
            <span className="text-gray-400">
              {room.players.length}/{room.settings.maxPlayers} players
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`player-card ${player.isReady ? 'border-green-500' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{player.name}</span>
                  <div className="flex gap-2 items-center">
                    {player.isHost && (
                      <span className="text-xs bg-mafia-red px-2 py-1 rounded">HOST</span>
                    )}
                    {player.isReady && (
                      <span className="text-xs bg-green-600 px-2 py-1 rounded">READY</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className={`btn ${yourPlayer?.isReady ? 'btn-secondary' : 'btn-success'} flex-1`}
              onClick={handleReady}
            >
              {yourPlayer?.isReady ? 'Not Ready' : 'Ready'}
            </button>

            {isHost && (
              <button
                className="btn btn-primary flex-1"
                onClick={handleStart}
                disabled={!canStart}
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
