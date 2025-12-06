# Mafia Game App - Technical Planning Document

## Overview
A real-time multiplayer Mafia game with lobby-based matchmaking, where players join using unique room codes and play the classic social deduction game.

---

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: TailwindCSS + shadcn/ui
- **State Management**: Zustand
- **Real-time**: Socket.IO Client
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: PostgreSQL (persistent data)
- **Cache/Sessions**: Redis (game state, rooms)
- **Validation**: Zod
- **Authentication**: JWT (optional for accounts)

### DevOps
- **Containerization**: Docker + Docker Compose
- **Environment**: dotenv
- **Database Migrations**: Prisma ORM
- **Testing**: Vitest (frontend), Jest (backend)

---

## Game Rules & Mechanics

### Player Roles
1. **Villager** - No special abilities, votes during day
2. **Mafia** - Kills one player each night, knows other mafia members
3. **Doctor** - Saves one player from death each night
4. **Detective** - Investigates one player each night to learn their role
5. **Moderator** - AI/automated game master

### Win Conditions
- **Villagers win**: All Mafia members eliminated
- **Mafia wins**: Mafia equals or outnumbers Villagers

### Game Flow
```
1. Lobby Phase
   └─> Players join with code
   └─> Host configures settings
   └─> All players ready up

2. Role Assignment Phase
   └─> Roles distributed randomly
   └─> Players see their role privately

3. Night Phase
   └─> Mafia chooses victim
   └─> Doctor chooses save target
   └─> Detective investigates player
   └─> All actions submitted → resolve

4. Day Phase
   └─> Results announced (deaths)
   └─> Discussion period (timed)
   └─> Voting period
   └─> Player with most votes eliminated
   └─> Check win conditions

5. Repeat 3-4 until game ends

6. Game Over
   └─> Winner announced
   └─> Stats displayed
   └─> Return to lobby option
```

### Player Counts & Role Distribution
- **5 players**: 2 Mafia, 1 Doctor, 2 Villagers
- **6-7 players**: 2 Mafia, 1 Doctor, 1 Detective, rest Villagers
- **8-10 players**: 3 Mafia, 1 Doctor, 1 Detective, rest Villagers
- **11-15 players**: 4 Mafia, 1 Doctor, 1 Detective, rest Villagers

---

## Architecture

### High-Level Architecture
```
┌──────────────────────────────────────┐
│         Client (Browser)              │
│  ┌────────────┐    ┌──────────────┐ │
│  │   React    │    │  Socket.IO   │ │
│  │    App     │◄──►│    Client    │ │
│  └────────────┘    └──────────────┘ │
└──────────────┬───────────────────────┘
               │ HTTPS/WSS
               │
┌──────────────▼───────────────────────┐
│         Backend Server                │
│  ┌────────────┐    ┌──────────────┐ │
│  │  Express   │◄──►│  Socket.IO   │ │
│  │    API     │    │    Server    │ │
│  └─────┬──────┘    └──────┬───────┘ │
│        │                   │          │
│  ┌─────▼──────┐    ┌──────▼───────┐ │
│  │   Game     │    │    Room      │ │
│  │  Engine    │    │   Manager    │ │
│  └─────┬──────┘    └──────┬───────┘ │
└────────┼──────────────────┼─────────┘
         │                  │
    ┌────▼─────┐      ┌────▼─────┐
    │PostgreSQL│      │  Redis   │
    │(Accounts)│      │ (Rooms)  │
    └──────────┘      └──────────┘
```

### Directory Structure
```
mafia/
├── client/                    # Frontend React app
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── lobby/         # Lobby components
│   │   │   ├── game/          # Game components
│   │   │   └── common/        # Shared components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── stores/            # Zustand stores
│   │   ├── services/          # API & Socket services
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utility functions
│   │   └── App.tsx            # Main app component
│   ├── package.json
│   └── vite.config.ts
│
├── server/                    # Backend Node.js app
│   ├── src/
│   │   ├── routes/            # Express routes
│   │   ├── sockets/           # Socket.IO handlers
│   │   ├── services/          # Business logic
│   │   │   ├── GameEngine.ts  # Core game logic
│   │   │   ├── RoomManager.ts # Room operations
│   │   │   └── RoleManager.ts # Role assignment
│   │   ├── models/            # Database models
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utilities
│   │   └── server.ts          # Entry point
│   ├── prisma/                # Database schema
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                    # Shared code
│   └── types/                 # Shared TypeScript types
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Database Schema

### PostgreSQL Tables (Persistent Data)

```typescript
// Optional - for user accounts
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  createdAt DateTime @default(now())
  stats     Stats?
}

model Stats {
  id            String  @id @default(uuid())
  userId        String  @unique
  user          User    @relation(fields: [userId], references: [id])
  gamesPlayed   Int     @default(0)
  gamesWon      Int     @default(0)
  gamesLost     Int     @default(0)
  timesVillager Int     @default(0)
  timesMafia    Int     @default(0)
  timesDoctor   Int     @default(0)
  timesDetective Int    @default(0)
}

model GameHistory {
  id          String   @id @default(uuid())
  roomCode    String
  winner      String   // 'mafia' | 'villagers'
  players     Json     // Array of player data
  duration    Int      // In seconds
  endedAt     DateTime @default(now())
}
```

### Redis Structure (Ephemeral Game State)

```typescript
// Room data
rooms:{roomCode} = {
  code: string,              // 6-digit code
  hostId: string,
  status: 'waiting' | 'playing' | 'finished',
  settings: {
    maxPlayers: number,
    nightDuration: number,    // seconds
    dayDuration: number,
    votingDuration: number,
  },
  players: Map<socketId, Player>,
  createdAt: timestamp,
}

// Game state
games:{roomCode} = {
  phase: 'night' | 'day' | 'voting' | 'results',
  round: number,
  roles: Map<socketId, Role>,
  alive: Set<socketId>,
  dead: Set<socketId>,
  nightActions: {
    mafiaVote: Map<socketId, targetId>,
    doctorSave: socketId | null,
    detectiveCheck: socketId | null,
  },
  dayVotes: Map<socketId, targetId>,
  history: Event[],
}
```

---

## API Design

### REST Endpoints

```typescript
// Room operations
POST   /api/rooms/create          // Create new room
POST   /api/rooms/:code/join      // Join room with code
GET    /api/rooms/:code           // Get room info
DELETE /api/rooms/:code           // Delete room (host only)

// Optional - User accounts
POST   /api/auth/register         // Create account
POST   /api/auth/login            // Login
GET    /api/users/:id/stats       // Get user stats
```

### Socket.IO Events

#### Client → Server
```typescript
// Lobby events
'lobby:join'                { roomCode, playerName }
'lobby:leave'               { roomCode }
'lobby:ready'               { roomCode, ready: boolean }
'lobby:start'               { roomCode }  // Host only
'lobby:kick'                { roomCode, playerId }  // Host only

// Game events
'game:night_action'         { action: 'kill' | 'save' | 'investigate', targetId }
'game:day_vote'             { targetId }
'game:chat_message'         { message, isPrivate }
```

#### Server → Client
```typescript
// Lobby events
'lobby:updated'             { room: Room }
'lobby:player_joined'       { player: Player }
'lobby:player_left'         { playerId }
'lobby:error'               { message }

// Game events
'game:started'              { role: Role }
'game:phase_changed'        { phase, duration, round }
'game:player_died'          { playerId, role, cause }
'game:day_results'          { eliminated: Player | null }
'game:night_results'        { killed: Player | null, saved: boolean }
'game:investigation_result' { targetId, role }  // Detective only
'game:ended'                { winner, stats }
'game:chat_message'         { from, message, timestamp }
```

---

## Game State Machine

```typescript
enum GamePhase {
  LOBBY = 'lobby',
  ROLE_ASSIGNMENT = 'role_assignment',
  NIGHT = 'night',
  NIGHT_RESULTS = 'night_results',
  DAY_DISCUSSION = 'day_discussion',
  DAY_VOTING = 'day_voting',
  DAY_RESULTS = 'day_results',
  GAME_OVER = 'game_over',
}

// State transitions
LOBBY → ROLE_ASSIGNMENT
  ↓
NIGHT → NIGHT_RESULTS → DAY_DISCUSSION → DAY_VOTING → DAY_RESULTS
  ↑                                                        ↓
  └────────────────────────────────────────────────────────┘
                                                           ↓
                                                      GAME_OVER
```

---

## Core Features

### Phase 1: MVP (Minimum Viable Product)
- [x] Lobby creation with unique codes
- [x] Player join/leave functionality
- [x] Basic roles: Mafia, Villager, Doctor, Detective
- [x] Night phase actions
- [x] Day phase discussion & voting
- [x] Win condition detection
- [x] Text chat (all players + Mafia-only)
- [x] Game state synchronization

### Phase 2: Enhanced Features
- [ ] User accounts & authentication
- [ ] Game history & statistics
- [ ] Customizable room settings
- [ ] Additional roles (Jester, Godfather, etc.)
- [ ] Spectator mode
- [ ] Timer UI with visual countdown
- [ ] Player avatars

### Phase 3: Advanced Features
- [ ] Voice chat integration
- [ ] Replay system
- [ ] Achievements/badges
- [ ] Ranked matchmaking
- [ ] Mobile app (React Native)
- [ ] Custom game modes

---

## Security Considerations

1. **Room Codes**: Use cryptographically random 6-digit codes
2. **Input Validation**: Validate all client inputs on server
3. **Rate Limiting**: Prevent spam and DoS attacks
4. **Action Verification**: Verify player can perform action (alive, correct phase, correct role)
5. **Secrets**: Never send full game state to clients, only what they should know
6. **XSS Protection**: Sanitize chat messages
7. **Socket Authentication**: Verify socket connections belong to room members

---

## Performance Considerations

1. **Redis for Game State**: Fast in-memory storage for real-time game data
2. **Connection Pooling**: Efficient database connections
3. **Event Throttling**: Limit rate of socket events
4. **Room Cleanup**: Auto-delete inactive rooms after 1 hour
5. **Horizontal Scaling**: Use Redis adapter for Socket.IO to scale across servers

---

## Testing Strategy

### Unit Tests
- Game logic (role assignment, win conditions)
- Utility functions
- State management

### Integration Tests
- API endpoints
- Socket event handlers
- Database operations

### E2E Tests
- Full game flow
- Multiple players simulation
- Edge cases (disconnections, timeouts)

---

## Development Phases

### Week 1-2: Foundation
- Project setup (monorepo structure)
- Database setup (PostgreSQL + Redis)
- Basic Express + Socket.IO server
- React app scaffolding
- Shared types package

### Week 3-4: Lobby System
- Room creation/joining
- Player management
- Ready/unready mechanism
- Host controls
- WebSocket synchronization

### Week 5-6: Game Engine
- Role assignment logic
- Phase management
- Night actions (kill, save, investigate)
- Day voting system
- Win condition detection

### Week 7-8: UI/UX
- Lobby interface
- Game board UI
- Chat interface
- Role cards & instructions
- Phase indicators & timers

### Week 9-10: Polish & Testing
- Bug fixes
- Performance optimization
- Comprehensive testing
- Documentation
- Deployment setup

---

## Deployment

### Docker Compose Setup
```yaml
services:
  postgres:
    image: postgres:15

  redis:
    image: redis:7-alpine

  server:
    build: ./server
    depends_on: [postgres, redis]

  client:
    build: ./client
    depends_on: [server]

  nginx:
    image: nginx:alpine
    depends_on: [client, server]
```

### Environment Variables
```
# Server
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
PORT=3000

# Client
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## Next Steps

1. Initialize project structure
2. Set up package.json files
3. Configure TypeScript
4. Set up database with Prisma
5. Create shared types package
6. Build basic Express server
7. Build basic React app
8. Implement room creation/joining
9. Build game engine
10. Create UI components

---

## Questions to Address

- Should we support anonymous play or require accounts?
  **Decision**: Support both - anonymous for quick play, accounts optional for stats

- Voice chat built-in or rely on external tools (Discord)?
  **Decision**: Start with text only, add voice in Phase 3

- Mobile responsive or separate mobile app?
  **Decision**: Start with responsive web, mobile app in Phase 3

- Public room listing or private codes only?
  **Decision**: Private codes only for MVP, add public listing in Phase 2

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Player disconnection | High | Implement reconnection with timeout grace period |
| Timer synchronization | Medium | Use server time, client displays countdown |
| Cheating via dev tools | Medium | Never send hidden info to client (other roles, mafia members) |
| Scaling issues | Low | Use Redis adapter, design for horizontal scaling |
| Abandoned rooms | Low | Auto-cleanup after 1 hour of inactivity |

---

## Resources

- Socket.IO docs: https://socket.io/docs/
- Prisma docs: https://www.prisma.io/docs
- React docs: https://react.dev
- Mafia rules: https://en.wikipedia.org/wiki/Mafia_(party_game)
