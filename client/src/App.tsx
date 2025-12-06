import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-mafia-darker">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby/:code" element={<LobbyPage />} />
          <Route path="/game/:code" element={<GamePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
