# Mafia Game - Setup & Implementation Guide

This guide walks through setting up the development environment and implementing the Mafia game from scratch.

---

## Phase 0: Project Initialization

### Step 1: Create Directory Structure

```bash
mkdir -p mafia/{client,server,shared}
cd mafia

# Client directories
mkdir -p client/src/{components/{lobby,game,common},hooks,stores,services,types,utils}

# Server directories
mkdir -p server/src/{routes,sockets,services,models,types,utils,middleware}
mkdir -p server/prisma

# Shared directories
mkdir -p shared/types
```

### Step 2: Initialize Package Files

#### Root package.json (Workspace)
```json
{
  "name": "mafia-game",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "client",
    "server",
    "shared"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

#### Server package.json
```json
{
  "name": "mafia-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.8.0",
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "redis": "^4.6.11",
    "zod": "^3.22.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.6",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0",
    "prisma": "^5.8.0"
  }
}
```

#### Client package.json
```json
{
  "name": "mafia-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "socket.io-client": "^4.6.1",
    "zustand": "^4.4.7",
    "zod": "^3.22.4",
    "react-hook-form": "^7.49.3",
    "@hookform/resolvers": "^3.3.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.47",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.10",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "vitest": "^1.1.0"
  }
}
```

### Step 3: Create Configuration Files

#### server/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### client/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### client/vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: mafia-postgres
    environment:
      POSTGRES_USER: mafia
      POSTGRES_PASSWORD: mafia_dev_password
      POSTGRES_DB: mafia
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: mafia-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### .gitignore
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
dist/
build/

# Env files
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Prisma
prisma/migrations/
!prisma/migrations/.gitkeep

# Database
*.db
*.db-journal
```

---

## Phase 1: Backend Core Setup

### Step 1: Set Up Express Server

#### server/src/server.ts
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Initialize clients
export const prisma = new PrismaClient();
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/auth', authRoutes);

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Register socket handlers
  setupLobbyHandlers(io, socket);
  setupGameHandlers(io, socket);
  setupChatHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await redis.connect();
    console.log('✅ Connected to Redis');

    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.quit();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

### Step 2: Create Shared Types

#### shared/types/index.ts
```typescript
// Player types
export type Role = 'mafia' | 'villager' | 'doctor' | 'detective';

export interface Player {
  id: string;
  socketId: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  isAlive: boolean;
  role?: Role;
}

// Room types
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomSettings {
  maxPlayers: number;
  nightDuration: number;
  dayDuration: number;
  votingDuration: number;
}

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: Player[];
  createdAt: string;
}

// Game types
export type GamePhase =
  | 'role_assignment'
  | 'night'
  | 'night_results'
  | 'day_discussion'
  | 'day_voting'
  | 'day_results'
  | 'game_over';

export interface GameState {
  phase: GamePhase;
  round: number;
  roles: Record<string, Role>;
  alive: string[];
  dead: string[];
  nightActions: {
    mafiaVotes: Record<string, string>;
    doctorSave: string | null;
    detectiveCheck: string | null;
  };
  dayVotes: Record<string, string>;
  history: GameEvent[];
}

export interface GameEvent {
  type: 'kill' | 'save' | 'investigate' | 'vote' | 'elimination';
  round: number;
  phase: GamePhase;
  actor?: string;
  target?: string;
  result?: string;
  timestamp: string;
}

// Socket event types
export interface LobbyJoinPayload {
  roomCode: string;
  playerName: string;
  playerId: string;
}

export interface NightActionPayload {
  roomCode: string;
  action: 'kill' | 'save' | 'investigate';
  targetId: string;
}

export interface DayVotePayload {
  roomCode: string;
  targetId: string;
}

export interface ChatMessagePayload {
  roomCode: string;
  message: string;
  isPrivate: boolean;
}
```

### Step 3: Install Dependencies

```bash
# Root
npm install

# Server
cd server
npm install
npx prisma generate

# Client
cd ../client
npm install
```

---

## Phase 2: Implement Room Manager

### server/src/services/RoomManager.ts
```typescript
import { redis } from '../server.js';
import { Room, RoomSettings, Player } from '../../../shared/types/index.js';
import { generateRoomCode } from '../utils/roomCode.js';

export class RoomManager {
  private static ROOM_PREFIX = 'room:';
  private static ROOM_TTL = 3600; // 1 hour

  static async createRoom(
    hostId: string,
    hostName: string,
    settings: RoomSettings
  ): Promise<Room> {
    const code = generateRoomCode();

    const room: Room = {
      code,
      hostId,
      status: 'waiting',
      settings,
      players: [
        {
          id: hostId,
          socketId: '',
          name: hostName,
          isReady: false,
          isHost: true,
          isConnected: false,
          isAlive: true,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    await redis.setEx(
      `${this.ROOM_PREFIX}${code}`,
      this.ROOM_TTL,
      JSON.stringify(room)
    );

    return room;
  }

  static async getRoom(code: string): Promise<Room | null> {
    const data = await redis.get(`${this.ROOM_PREFIX}${code}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  static async updateRoom(room: Room): Promise<void> {
    await redis.setEx(
      `${this.ROOM_PREFIX}${room.code}`,
      this.ROOM_TTL,
      JSON.stringify(room)
    );
  }

  static async deleteRoom(code: string): Promise<void> {
    await redis.del(`${this.ROOM_PREFIX}${code}`);
  }

  static async addPlayer(
    code: string,
    player: Player
  ): Promise<Room | null> {
    const room = await this.getRoom(code);
    if (!room) return null;

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    room.players.push(player);
    await this.updateRoom(room);
    return room;
  }

  static async removePlayer(
    code: string,
    playerId: string
  ): Promise<Room | null> {
    const room = await this.getRoom(code);
    if (!room) return null;

    room.players = room.players.filter((p) => p.id !== playerId);

    // Transfer host if needed
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    // Delete room if empty
    if (room.players.length === 0) {
      await this.deleteRoom(code);
      return null;
    }

    await this.updateRoom(room);
    return room;
  }
}
```

### server/src/utils/roomCode.ts
```typescript
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

---

## Phase 3: Implement Game Engine

See GAME_LOGIC.md for full implementation details.

Key files to create:
- `server/src/services/GameEngine.ts` - Core game logic
- `server/src/services/RoleManager.ts` - Role assignment
- `server/src/services/PhaseManager.ts` - Phase transitions

---

## Phase 4: Create REST API Routes

See API_SPEC.md for full endpoint specifications.

Create:
- `server/src/routes/rooms.ts`
- `server/src/routes/auth.ts`

---

## Phase 5: Implement Socket.IO Handlers

Create:
- `server/src/sockets/lobbyHandlers.ts`
- `server/src/sockets/gameHandlers.ts`
- `server/src/sockets/chatHandlers.ts`

---

## Phase 6: Build React Frontend

### Key Components to Build

1. **Lobby Components**
   - `LobbyCreate.tsx` - Create room form
   - `LobbyJoin.tsx` - Join room form
   - `LobbyRoom.tsx` - Waiting room
   - `PlayerList.tsx` - List of players

2. **Game Components**
   - `GameBoard.tsx` - Main game interface
   - `RoleCard.tsx` - Your role display
   - `PlayerGrid.tsx` - All players
   - `ActionPanel.tsx` - Night/day actions
   - `VotingPanel.tsx` - Voting interface
   - `ChatBox.tsx` - Chat interface

3. **Stores**
   - `useRoomStore.ts` - Lobby state
   - `useGameStore.ts` - Game state
   - `useSocketStore.ts` - Socket connection

---

## Phase 7: Testing

### Unit Tests
```bash
# Server
cd server
npm test

# Client
cd client
npm test
```

### Integration Tests
Test full game flow with multiple simulated players

### E2E Tests
Use Playwright for end-to-end testing

---

## Phase 8: Deployment

### Build Production Images
```bash
# Build frontend
cd client
npm run build

# Build backend
cd server
npm run build
```

### Deploy with Docker
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Next Steps

1. ✅ Complete project initialization
2. [ ] Implement RoomManager
3. [ ] Implement GameEngine
4. [ ] Build REST API
5. [ ] Implement Socket.IO handlers
6. [ ] Build React components
7. [ ] Add styling with Tailwind
8. [ ] Write tests
9. [ ] Deploy to production

---

## Useful Commands

```bash
# Start development
npm run dev

# Database
npm run db:migrate     # Run migrations
npm run db:studio      # Open Prisma Studio

# Testing
npm test              # Run all tests
npm run test:watch    # Watch mode

# Building
npm run build         # Build all packages

# Docker
docker-compose up     # Start services
docker-compose down   # Stop services
docker-compose logs   # View logs
```

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
# Start Redis
docker-compose up redis -d

# Check Redis
redis-cli ping
```

### PostgreSQL Connection Failed
```bash
# Start PostgreSQL
docker-compose up postgres -d

# Check connection
psql -h localhost -U mafia -d mafia
```

---

## Resources

- [React Documentation](https://react.dev)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Mafia Game Rules](https://en.wikipedia.org/wiki/Mafia_(party_game))
