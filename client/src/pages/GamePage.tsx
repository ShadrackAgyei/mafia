import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socketService } from '../services/socket';
import { useGameStore } from '../stores/useGameStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useChatStore } from '../stores/useChatStore';

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const { room, yourPlayerId } = useRoomStore();
  const {
    phase,
    round,
    yourRole,
    mafiaMembers,
    alive,
    dead,
    selectedTarget,
    selectTarget,
    setPhase,
    addDead,
    setVoteCounts,
  } = useGameStore();
  const { addMessage } = useChatStore();
  const [message, setMessage] = useState('');

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('game:phase_changed', (data) => {
      setPhase(data.phase, data.endsAt);
    });

    socket.on('game:night_results', (data) => {
      if (data.killed) {
        addDead(data.killed.playerId);
      }
    });

    socket.on('game:day_results', (data) => {
      if (data.eliminated) {
        addDead(data.eliminated.playerId);
      }
    });

    socket.on('game:vote_updated', (data) => {
      setVoteCounts(data.votes, data.hasVoted);
    });

    socket.on('chat:message', (data) => {
      addMessage(data);
    });

    socket.on('game:ended', (data) => {
      alert(`Game Over! Winner: ${data.winner}`);
    });

    return () => {
      socket.off('game:phase_changed');
      socket.off('game:night_results');
      socket.off('game:day_results');
      socket.off('game:vote_updated');
      socket.off('chat:message');
      socket.off('game:ended');
    };
  }, []);

  const handleAction = () => {
    if (!code || !selectedTarget) return;

    if (phase === 'night') {
      let action: 'kill' | 'save' | 'investigate';
      if (yourRole === 'mafia') action = 'kill';
      else if (yourRole === 'doctor') action = 'save';
      else if (yourRole === 'detective') action = 'investigate';
      else return;

      socketService.submitNightAction({ roomCode: code, action, targetId: selectedTarget });
    } else if (phase === 'day_voting') {
      socketService.submitDayVote({ roomCode: code, targetId: selectedTarget });
    }

    selectTarget(null);
  };

  const handleSendMessage = () => {
    if (!code || !message.trim()) return;
    socketService.sendMessage({
      roomCode: code,
      message: message.trim(),
      isPrivate: false,
    });
    setMessage('');
  };

  const isDead = yourPlayerId ? dead.includes(yourPlayerId) : false;
  const alivePlayers = room?.players.filter((p) => alive.includes(p.id)) || [];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="card mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Round {round}</h2>
              <p className="text-gray-400 capitalize">{phase.replace('_', ' ')}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-mafia-red">Your Role: {yourRole}</p>
              {isDead && <p className="text-red-500">You are dead</p>}
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="card mb-4">
          <h3 className="text-lg font-bold mb-4">Players ({alivePlayers.length} alive)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {room?.players.map((player) => {
              const isAlive = alive.includes(player.id);
              const isSelected = selectedTarget === player.id;
              const canSelect =
                !isDead &&
                isAlive &&
                player.id !== yourPlayerId &&
                (phase === 'night' || phase === 'day_voting');

              return (
                <button
                  key={player.id}
                  className={`player-card text-left ${!isAlive ? 'dead' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  onClick={() => canSelect && selectTarget(player.id)}
                  disabled={!canSelect}
                >
                  <p className="font-medium">{player.name}</p>
                  {!isAlive && <p className="text-xs text-red-500">Dead</p>}
                  {mafiaMembers.includes(player.id) && (
                    <p className="text-xs text-mafia-red">Mafia</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action */}
        {selectedTarget && (
          <div className="card mb-4">
            <button className="btn btn-primary w-full" onClick={handleAction}>
              Confirm Action
            </button>
          </div>
        )}

        {/* Chat */}
        <div className="card">
          <h3 className="text-lg font-bold mb-4">Chat</h3>
          <div className="h-40 overflow-y-auto bg-mafia-darker rounded p-3 mb-3">
            {useChatStore.getState().messages.map((msg, i) => (
              <div key={i} className="mb-2">
                <span className="font-medium text-mafia-red">{msg.from.name}: </span>
                <span>{msg.message}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isDead}
            />
            <button className="btn btn-primary" onClick={handleSendMessage} disabled={isDead}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
