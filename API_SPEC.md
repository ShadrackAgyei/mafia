# Mafia Game - API Specification

## Overview
This document defines all REST API endpoints and WebSocket events for the Mafia game.

**Base URL**: `http://localhost:3000/api`
**WebSocket URL**: `ws://localhost:3000`

---

## REST API Endpoints

### Room Management

#### Create Room
```http
POST /api/rooms/create
```

**Request Body**:
```json
{
  "playerName": "string",
  "settings": {
    "maxPlayers": 10,
    "nightDuration": 60,
    "dayDuration": 120,
    "votingDuration": 45
  }
}
```

**Response** (200):
```json
{
  "roomCode": "ABC123",
  "hostId": "uuid",
  "room": {
    "code": "ABC123",
    "hostId": "uuid",
    "status": "waiting",
    "settings": { /* ... */ },
    "players": [
      {
        "id": "uuid",
        "name": "Player 1",
        "isReady": false,
        "isHost": true
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Errors**:
- `400`: Invalid settings
- `500`: Server error

---

#### Join Room
```http
POST /api/rooms/:code/join
```

**Request Body**:
```json
{
  "playerName": "string"
}
```

**Response** (200):
```json
{
  "playerId": "uuid",
  "room": {
    "code": "ABC123",
    "hostId": "uuid",
    "status": "waiting",
    "settings": { /* ... */ },
    "players": [ /* ... */ ]
  }
}
```

**Errors**:
- `404`: Room not found
- `409`: Room is full
- `409`: Room already started
- `400`: Invalid player name

---

#### Get Room Info
```http
GET /api/rooms/:code
```

**Response** (200):
```json
{
  "code": "ABC123",
  "status": "waiting" | "playing" | "finished",
  "playerCount": 5,
  "maxPlayers": 10,
  "hostName": "Player 1",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Errors**:
- `404`: Room not found

---

#### Delete Room
```http
DELETE /api/rooms/:code
```

**Headers**:
```
Authorization: Bearer <hostToken>
```

**Response** (200):
```json
{
  "message": "Room deleted successfully"
}
```

**Errors**:
- `404`: Room not found
- `403`: Not authorized (not host)

---

### User Management (Optional)

#### Register
```http
POST /api/auth/register
```

**Request Body**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response** (201):
```json
{
  "user": {
    "id": "uuid",
    "username": "player123",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "token": "jwt_token"
}
```

**Errors**:
- `400`: Validation error
- `409`: Username/email already exists

---

#### Login
```http
POST /api/auth/login
```

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "username": "player123"
  },
  "token": "jwt_token"
}
```

**Errors**:
- `401`: Invalid credentials

---

#### Get User Stats
```http
GET /api/users/:id/stats
```

**Response** (200):
```json
{
  "stats": {
    "gamesPlayed": 42,
    "gamesWon": 20,
    "gamesLost": 22,
    "winRate": 0.476,
    "timesVillager": 25,
    "timesMafia": 12,
    "timesDoctor": 3,
    "timesDetective": 2,
    "timesKilledNight": 15,
    "timesVotedOut": 8,
    "timesSurvived": 19
  }
}
```

**Errors**:
- `404`: User not found

---

## WebSocket Events

### Connection

#### Connect to Server
```typescript
// Client
import io from 'socket.io-client';
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

---

### Lobby Events

#### Join Lobby
**Client → Server**
```typescript
socket.emit('lobby:join', {
  roomCode: 'ABC123',
  playerName: 'Player 1',
  playerId: 'uuid' // from REST API
});
```

**Server → Client** (Success)
```typescript
socket.on('lobby:joined', (data) => {
  // data:
  {
    room: {
      code: 'ABC123',
      hostId: 'uuid',
      status: 'waiting',
      players: [
        {
          id: 'uuid',
          socketId: 'socket_id',
          name: 'Player 1',
          isReady: false,
          isHost: true,
          isConnected: true
        }
      ],
      settings: { /* ... */ }
    },
    yourPlayerId: 'uuid'
  }
});
```

**Server → All in Room** (Broadcast)
```typescript
socket.on('lobby:player_joined', (data) => {
  // data:
  {
    player: {
      id: 'uuid',
      name: 'Player 2',
      isReady: false,
      isHost: false
    },
    playerCount: 2
  }
});
```

**Server → Client** (Error)
```typescript
socket.on('lobby:error', (error) => {
  // error:
  {
    code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_IN_PROGRESS',
    message: 'Error description'
  }
});
```

---

#### Leave Lobby
**Client → Server**
```typescript
socket.emit('lobby:leave', {
  roomCode: 'ABC123'
});
```

**Server → All in Room**
```typescript
socket.on('lobby:player_left', (data) => {
  // data:
  {
    playerId: 'uuid',
    playerName: 'Player 1',
    playerCount: 1,
    newHostId: 'uuid' // if previous host left
  }
});
```

---

#### Toggle Ready
**Client → Server**
```typescript
socket.emit('lobby:ready', {
  roomCode: 'ABC123',
  ready: true
});
```

**Server → All in Room**
```typescript
socket.on('lobby:player_ready', (data) => {
  // data:
  {
    playerId: 'uuid',
    playerName: 'Player 1',
    isReady: true,
    allReady: false // true if all players ready
  }
});
```

---

#### Start Game
**Client → Server** (Host only)
```typescript
socket.emit('lobby:start', {
  roomCode: 'ABC123'
});
```

**Server → All in Room**
```typescript
socket.on('game:started', (data) => {
  // data:
  {
    gameId: 'uuid',
    yourRole: 'mafia' | 'villager' | 'doctor' | 'detective',
    mafiaMembers: ['uuid1', 'uuid2'], // Only if you're mafia
    totalPlayers: 5,
    startedAt: '2024-01-01T00:00:00Z'
  }
});
```

---

#### Kick Player
**Client → Server** (Host only)
```typescript
socket.emit('lobby:kick', {
  roomCode: 'ABC123',
  playerId: 'uuid'
});
```

**Server → Kicked Player**
```typescript
socket.on('lobby:kicked', () => {
  // Redirect to home
});
```

**Server → All Others**
```typescript
socket.on('lobby:player_left', { /* ... */ });
```

---

#### Update Settings
**Client → Server** (Host only)
```typescript
socket.emit('lobby:update_settings', {
  roomCode: 'ABC123',
  settings: {
    maxPlayers: 12,
    nightDuration: 90,
    dayDuration: 180,
    votingDuration: 60
  }
});
```

**Server → All in Room**
```typescript
socket.on('lobby:settings_updated', (data) => {
  // data:
  {
    settings: { /* new settings */ }
  }
});
```

---

### Game Events

#### Phase Changed
**Server → All Players**
```typescript
socket.on('game:phase_changed', (data) => {
  // data:
  {
    phase: 'night' | 'night_results' | 'day_discussion' | 'day_voting' | 'day_results',
    round: 1,
    duration: 60, // seconds (null if no timer)
    endsAt: '2024-01-01T00:01:00Z' // ISO timestamp
  }
});
```

---

#### Night Action
**Client → Server**
```typescript
// Mafia vote
socket.emit('game:night_action', {
  roomCode: 'ABC123',
  action: 'kill',
  targetId: 'uuid'
});

// Doctor save
socket.emit('game:night_action', {
  roomCode: 'ABC123',
  action: 'save',
  targetId: 'uuid'
});

// Detective investigate
socket.emit('game:night_action', {
  roomCode: 'ABC123',
  action: 'investigate',
  targetId: 'uuid'
});
```

**Server → Client** (Confirmation)
```typescript
socket.on('game:action_submitted', (data) => {
  // data:
  {
    action: 'kill' | 'save' | 'investigate',
    targetId: 'uuid',
    targetName: 'Player 3'
  }
});
```

**Server → Client** (Error)
```typescript
socket.on('game:action_error', (error) => {
  // error:
  {
    code: 'INVALID_TARGET' | 'WRONG_PHASE' | 'ALREADY_DEAD' | 'NOT_YOUR_TURN',
    message: 'Error description'
  }
});
```

---

#### Night Results
**Server → All Players**
```typescript
socket.on('game:night_results', (data) => {
  // data:
  {
    killed: {
      playerId: 'uuid',
      playerName: 'Player 3',
      role: 'villager'
    } | null, // null if saved or no kill
    saved: boolean, // true if doctor saved the target
    round: 1
  }
});
```

**Server → Detective Only**
```typescript
socket.on('game:investigation_result', (data) => {
  // data:
  {
    targetId: 'uuid',
    targetName: 'Player 4',
    role: 'mafia'
  }
});
```

---

#### Day Vote
**Client → Server**
```typescript
socket.emit('game:day_vote', {
  roomCode: 'ABC123',
  targetId: 'uuid' // or 'skip'
});
```

**Server → All Players** (Live vote counts)
```typescript
socket.on('game:vote_updated', (data) => {
  // data:
  {
    votes: {
      'uuid1': 2, // Player 1 has 2 votes
      'uuid2': 1,
      'skip': 1
    },
    hasVoted: ['uuid3', 'uuid4'], // List of players who voted
    totalVotes: 4,
    requiredVotes: 5
  }
});
```

---

#### Day Results
**Server → All Players**
```typescript
socket.on('game:day_results', (data) => {
  // data:
  {
    eliminated: {
      playerId: 'uuid',
      playerName: 'Player 4',
      role: 'mafia',
      votes: 3
    } | null, // null if tie or skip
    votingResults: {
      'uuid1': { votes: 2, votedBy: ['uuid3', 'uuid4'] },
      'uuid2': { votes: 1, votedBy: ['uuid5'] },
      'skip': { votes: 1, votedBy: ['uuid1'] }
    },
    round: 1
  }
});
```

---

#### Game Over
**Server → All Players**
```typescript
socket.on('game:ended', (data) => {
  // data:
  {
    winner: 'mafia' | 'villagers',
    reason: 'majority' | 'elimination',
    rounds: 3,
    duration: 720, // seconds
    players: [
      {
        id: 'uuid',
        name: 'Player 1',
        role: 'mafia',
        survived: false,
        killedRound: 2,
        killedBy: 'vote',
        won: true
      },
      // ...
    ],
    mvp: {
      playerId: 'uuid',
      playerName: 'Player 2',
      reason: 'Saved 2 players as Doctor'
    }
  }
});
```

---

### Chat Events

#### Send Message
**Client → Server**
```typescript
socket.emit('chat:send', {
  roomCode: 'ABC123',
  message: 'I think Player 3 is suspicious',
  isPrivate: false // true for mafia-only chat
});
```

**Server → Appropriate Players**
```typescript
socket.on('chat:message', (data) => {
  // data:
  {
    from: {
      id: 'uuid',
      name: 'Player 1'
    },
    message: 'I think Player 3 is suspicious',
    timestamp: '2024-01-01T00:00:00Z',
    isPrivate: false, // true if mafia-only
    isDead: false // true if from dead player
  }
});
```

---

### Player State Events

#### Player Died
**Server → All Players**
```typescript
socket.on('game:player_died', (data) => {
  // data:
  {
    playerId: 'uuid',
    playerName: 'Player 3',
    role: 'villager',
    cause: 'mafia' | 'vote',
    round: 2,
    remainingPlayers: 4
  }
});
```

---

#### Player Disconnected
**Server → All Players**
```typescript
socket.on('player:disconnected', (data) => {
  // data:
  {
    playerId: 'uuid',
    playerName: 'Player 2',
    canReconnect: true,
    timeoutAt: '2024-01-01T00:01:00Z' // 60s reconnection window
  }
});
```

---

#### Player Reconnected
**Server → All Players**
```typescript
socket.on('player:reconnected', (data) => {
  // data:
  {
    playerId: 'uuid',
    playerName: 'Player 2'
  }
});
```

**Server → Reconnected Player**
```typescript
socket.on('game:state_sync', (data) => {
  // Full game state for reconnected player
  {
    room: { /* room data */ },
    game: {
      phase: 'day_discussion',
      round: 2,
      yourRole: 'detective',
      alive: ['uuid1', 'uuid2', 'uuid3'],
      dead: ['uuid4', 'uuid5'],
      // ... other relevant state
    }
  }
});
```

---

## WebSocket Error Codes

| Code | Description |
|------|-------------|
| `ROOM_NOT_FOUND` | Room code doesn't exist |
| `ROOM_FULL` | Room has reached max players |
| `GAME_IN_PROGRESS` | Cannot join, game already started |
| `INVALID_ACTION` | Action not allowed in current phase |
| `INVALID_TARGET` | Target player doesn't exist or invalid |
| `ALREADY_DEAD` | Cannot target dead player |
| `NOT_AUTHORIZED` | Player not authorized for this action |
| `WRONG_PHASE` | Action not allowed in current phase |
| `NOT_YOUR_TURN` | Not your turn to act |
| `DUPLICATE_NAME` | Player name already in use |

---

## Data Models

### Room
```typescript
interface Room {
  code: string;              // 6-character alphanumeric
  hostId: string;            // Player ID of host
  status: 'waiting' | 'playing' | 'finished';
  settings: RoomSettings;
  players: Player[];
  createdAt: string;         // ISO timestamp
}
```

### Player
```typescript
interface Player {
  id: string;                // UUID
  socketId: string;          // Socket.IO ID
  name: string;              // Display name
  isReady: boolean;          // Ready status (lobby only)
  isHost: boolean;           // Is room host
  isConnected: boolean;      // Connection status
  isAlive: boolean;          // Alive status (game only)
  role?: Role;               // Role (hidden from other players)
}
```

### RoomSettings
```typescript
interface RoomSettings {
  maxPlayers: number;        // 5-15
  nightDuration: number;     // 30-120 seconds
  dayDuration: number;       // 60-300 seconds
  votingDuration: number;    // 30-60 seconds
}
```

### Role
```typescript
type Role = 'mafia' | 'villager' | 'doctor' | 'detective';
```

### GameState
```typescript
interface GameState {
  phase: GamePhase;
  round: number;
  roles: Map<string, Role>;
  alive: Set<string>;        // Player IDs
  dead: Set<string>;         // Player IDs
  nightActions: {
    mafiaVotes: Map<string, string>;  // mafiaId -> targetId
    doctorSave: string | null;
    detectiveCheck: string | null;
  };
  dayVotes: Map<string, string>;      // voterId -> targetId
  history: GameEvent[];
}
```

### GameEvent
```typescript
interface GameEvent {
  type: 'kill' | 'save' | 'investigate' | 'vote' | 'elimination';
  round: number;
  phase: GamePhase;
  actor?: string;            // Player who performed action
  target?: string;           // Target of action
  result?: string;           // Outcome
  timestamp: string;         // ISO timestamp
}
```

---

## Rate Limiting

To prevent abuse:

| Event | Limit |
|-------|-------|
| `lobby:join` | 5 per minute |
| `chat:send` | 10 per 10 seconds |
| `game:night_action` | 1 per night phase |
| `game:day_vote` | Vote changes limited to 5 per voting phase |

---

## Authentication Flow

### Anonymous Play (Default)
```
1. Client calls POST /api/rooms/create or POST /api/rooms/:code/join
2. Server returns playerId (UUID)
3. Client stores playerId in localStorage
4. Client connects WebSocket with playerId in auth payload
5. Server validates playerId exists in room
```

### Authenticated Play (Optional)
```
1. Client calls POST /api/auth/login
2. Server returns JWT token
3. Client stores token
4. Client includes token in WebSocket connection auth
5. Server validates JWT and links to user account
```

---

## Example Client Implementation

### Joining a Room
```typescript
import io from 'socket.io-client';

// 1. Join via REST API
const response = await fetch('/api/rooms/ABC123/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerName: 'Player 1' })
});
const { playerId, room } = await response.json();

// 2. Connect WebSocket
const socket = io('http://localhost:3000', {
  auth: { playerId }
});

// 3. Join lobby
socket.emit('lobby:join', {
  roomCode: 'ABC123',
  playerName: 'Player 1',
  playerId
});

// 4. Listen for events
socket.on('lobby:joined', (data) => {
  console.log('Joined room:', data.room);
});

socket.on('game:started', (data) => {
  console.log('Game started! Your role:', data.yourRole);
});
```

---

## Testing Endpoints with curl

### Create Room
```bash
curl -X POST http://localhost:3000/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{
    "playerName": "Player 1",
    "settings": {
      "maxPlayers": 10,
      "nightDuration": 60,
      "dayDuration": 120,
      "votingDuration": 45
    }
  }'
```

### Join Room
```bash
curl -X POST http://localhost:3000/api/rooms/ABC123/join \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Player 2"}'
```

### Get Room Info
```bash
curl http://localhost:3000/api/rooms/ABC123
```

---

## Next Steps

1. [ ] Implement REST API routes
2. [ ] Implement Socket.IO event handlers
3. [ ] Add request validation with Zod
4. [ ] Implement rate limiting
5. [ ] Add error handling middleware
6. [ ] Write API integration tests
7. [ ] Generate OpenAPI/Swagger docs
8. [ ] Set up API monitoring
