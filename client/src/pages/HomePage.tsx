import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.createRoom({ playerName: playerName.trim() });
      localStorage.setItem('playerId', response.hostId);
      localStorage.setItem('playerName', playerName.trim());
      navigate(`/lobby/${response.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter room code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.joinRoom(roomCode.toUpperCase(), {
        playerName: playerName.trim(),
      });
      localStorage.setItem('playerId', response.playerId);
      localStorage.setItem('playerName', playerName.trim());
      navigate(`/lobby/${roomCode.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-mafia-red">Mafia Game</h1>
        <p className="text-center text-gray-400 mb-8">Social Deduction Game</p>

        {error && (
          <div className="bg-red-900 bg-opacity-20 border border-red-700 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <input
            type="text"
            className="input w-full"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
          />
        </div>

        <div className="space-y-3">
          <button
            className="btn btn-primary w-full"
            onClick={handleCreateRoom}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button
              className="btn btn-secondary"
              onClick={handleJoinRoom}
              disabled={loading}
            >
              Join
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>5-15 players • Real-time multiplayer</p>
        </div>
      </div>
    </div>
  );
}
