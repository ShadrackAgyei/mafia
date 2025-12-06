# Mafia Game - Implementation Complete! 🎮

## What's Been Built

A fully functional real-time multiplayer Mafia game with:

### ✅ Backend (Node.js + TypeScript)
- **Express API** with room management endpoints
- **Socket.IO** real-time communication
- **Redis** for game state and room management
- **PostgreSQL** with Prisma ORM (optional user accounts)
- **Complete game engine** with phase management
- **Role assignment** system (Mafia, Villager, Doctor, Detective)
- **Win condition** detection
- **Chat system** (public + mafia-only private)

### ✅ Frontend (React + TypeScript)
- **Home page** - Create or join rooms
- **Lobby page** - Player list, ready system, host controls
- **Game page** - Full game interface with actions and voting
- **Real-time updates** via Socket.IO
- **Zustand state management**
- **TailwindCSS styling**

### ✅ Game Features
- 5-15 player support
- Lobby system with unique 6-digit room codes
- Role distribution based on player count
- Night phase: Mafia kills, Doctor saves, Detective investigates
- Day phase: Discussion and voting
- Real-time vote tracking
- Disconnection handling
- Win condition checking

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### 1. Start Database Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify they're running
docker-compose ps
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 3. Setup Database

```bash
# Generate Prisma client
cd server
npx prisma generate

# Run migrations (optional - creates user tables)
npx prisma migrate dev

cd ..
```

### 4. Start Development Servers

**Option A: Start both servers simultaneously (recommended)**
```bash
npm run dev
```

**Option B: Start servers separately**

Terminal 1 (Backend):
```bash
cd server
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client
npm run dev
```

### 5. Open the Game

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

---

## How to Play

### Creating a Room
1. Open http://localhost:5173
2. Enter your name
3. Click "Create Room"
4. Share the 6-digit room code with friends

### Joining a Room
1. Open http://localhost:5173
2. Enter your name
3. Enter the room code
4. Click "Join"

### Starting the Game
1. All players click "Ready"
2. Host clicks "Start Game"
3. Each player receives their role
4. Game begins!

### Game Flow
1. **Night Phase**: Special roles take actions
   - Mafia votes to kill someone
   - Doctor chooses who to save
   - Detective investigates a player
2. **Day Phase**: Discussion and voting
   - Players discuss who they suspect
   - Everyone votes to eliminate a player
3. **Repeat** until win condition met

### Win Conditions
- **Villagers win**: All Mafia eliminated
- **Mafia wins**: Mafia ≥ Villagers

---

## Project Structure

```
mafia/
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/       # HomePage, LobbyPage, GamePage
│   │   ├── stores/      # Zustand stores
│   │   ├── services/    # Socket.IO and API services
│   │   └── App.tsx
│   └── package.json
│
├── server/              # Node.js backend
│   ├── src/
│   │   ├── routes/      # REST API routes
│   │   ├── sockets/     # Socket.IO handlers
│   │   ├── services/    # Game logic (GameEngine, RoomManager, etc.)
│   │   └── server.ts
│   └── package.json
│
├── shared/              # Shared TypeScript types
│   └── types/
│       └── index.ts
│
├── docker-compose.yml   # PostgreSQL + Redis
└── package.json         # Workspace root
```

---

## Available Commands

### Root
```bash
npm run dev          # Start both client and server
npm run build        # Build all packages
npm test             # Run all tests
```

### Server
```bash
cd server
npm run dev          # Start dev server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Run production server
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

### Client
```bash
cd client
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

---

## Environment Variables

### Server (.env)
```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://mafia:mafia_dev_password@localhost:5432/mafia
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

## API Endpoints

### REST API
- `POST /api/rooms/create` - Create new room
- `POST /api/rooms/:code/join` - Join room
- `GET /api/rooms/:code` - Get room info
- `DELETE /api/rooms/:code` - Delete room (host only)
- `GET /health` - Health check

### Socket.IO Events

**Lobby**:
- `lobby:join` - Join lobby
- `lobby:leave` - Leave lobby
- `lobby:ready` - Toggle ready status
- `lobby:start` - Start game (host only)
- `lobby:kick` - Kick player (host only)

**Game**:
- `game:night_action` - Submit night action
- `game:day_vote` - Submit day vote

**Chat**:
- `chat:send` - Send chat message

---

## Tech Stack

### Backend
- Node.js 20 + TypeScript
- Express.js
- Socket.IO
- PostgreSQL + Prisma ORM
- Redis
- Zod (validation)

### Frontend
- React 18 + TypeScript
- Vite
- React Router v6
- Socket.IO Client
- Zustand (state management)
- TailwindCSS

### DevOps
- Docker Compose
- ESM modules throughout

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Redis Connection Failed
```bash
# Restart Redis
docker-compose restart redis

# Check Redis
docker-compose logs redis
```

### PostgreSQL Connection Failed
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL
docker-compose logs postgres
```

### Module Not Found Errors
```bash
# Clean install
rm -rf node_modules client/node_modules server/node_modules shared/node_modules
npm install
```

---

## Development Tips

1. **Hot Reload**: Both client and server have hot reload enabled
2. **Console Logs**: Check browser console for client logs, terminal for server logs
3. **Redux DevTools**: Use Zustand DevTools for state debugging
4. **Database**: Use Prisma Studio to view database: `cd server && npx prisma studio`
5. **Redis**: Use Redis CLI to inspect data: `docker exec -it mafia-redis redis-cli`

---

## What's Next?

### Phase 2 Enhancements
- User accounts and authentication
- Game history and statistics
- Additional roles (Jester, Godfather, Serial Killer)
- Spectator mode
- Customizable room settings UI

### Phase 3 Advanced Features
- Voice chat integration
- Game replay system
- Achievements and badges
- Ranked matchmaking
- Mobile app (React Native)

---

## Testing

Create multiple browser windows/tabs to test multiplayer:
1. Window 1: Create room
2. Window 2-5: Join with different names
3. All windows: Click ready
4. Window 1 (host): Start game
5. Play the game!

---

## Credits

Built with modern web technologies for real-time multiplayer gaming.

**Made with ❤️ for the classic Mafia party game**
