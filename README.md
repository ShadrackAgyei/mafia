# Mafia Game

A real-time multiplayer social deduction game where players join lobbies using unique room codes and compete in the classic Mafia game.

## Features

- 🎮 **Lobby-based matchmaking** with unique room codes
- 👥 **5-15 player support** with role distribution
- 🎭 **Classic roles**: Mafia, Villager, Doctor, Detective
- 💬 **Real-time chat** with mafia-only private channels
- ⚡ **Live game updates** via WebSocket
- 📊 **Game statistics** and history tracking
- 🎨 **Modern UI** with responsive design

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui
- Socket.IO Client
- Zustand (state management)
- React Router v6

### Backend
- Node.js 20 + TypeScript
- Express.js
- Socket.IO
- PostgreSQL (Prisma ORM)
- Redis (game state cache)
- Zod (validation)

### DevOps
- Docker + Docker Compose
- GitHub Actions (CI/CD)

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/mafia.git
cd mafia
```

2. **Start services with Docker**
```bash
docker-compose up -d
```

3. **Install dependencies**
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

4. **Set up environment variables**
```bash
# Server (.env)
cp server/.env.example server/.env

# Client (.env)
cp client/.env.example client/.env
```

5. **Run database migrations**
```bash
cd server
npx prisma migrate dev
```

6. **Start development servers**
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

7. **Open the app**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Project Structure

```
mafia/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API & Socket services
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/         # Express routes
│   │   ├── sockets/        # Socket.IO handlers
│   │   ├── services/       # Business logic
│   │   ├── models/         # Database models
│   │   └── types/          # TypeScript types
│   ├── prisma/             # Database schema
│   └── package.json
│
├── shared/                 # Shared code
│   └── types/              # Shared TypeScript types
│
├── docs/                   # Documentation
│   ├── PLANNING.md         # Technical planning
│   ├── GAME_LOGIC.md       # Game rules & state machine
│   └── API_SPEC.md         # API documentation
│
├── docker-compose.yml
└── README.md
```

## Game Rules

### Roles

**Mafia** (2-5 players)
- Kill one player each night
- Know each other's identities
- Win by equaling or outnumbering villagers

**Villager** (varies)
- No special abilities
- Vote during day phase
- Win by eliminating all mafia

**Doctor** (1 player)
- Save one player from death each night
- Can save themselves

**Detective** (1 player)
- Investigate one player each night
- Learn their role

### Game Flow

1. **Lobby**: Players join with code, ready up
2. **Night**: Mafia kills, Doctor saves, Detective investigates
3. **Day**: Discussion and voting to eliminate a player
4. Repeat until win condition met

### Win Conditions

- **Villagers win**: All Mafia eliminated
- **Mafia wins**: Mafia ≥ Villagers

## Development

### Running Tests

```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test

# E2E tests
npm run test:e2e
```

### Building for Production

```bash
# Build frontend
cd client
npm run build

# Build backend
cd server
npm run build
```

### Database Management

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## API Documentation

See [API_SPEC.md](./API_SPEC.md) for detailed API documentation.

### REST Endpoints
- `POST /api/rooms/create` - Create new room
- `POST /api/rooms/:code/join` - Join room
- `GET /api/rooms/:code` - Get room info

### WebSocket Events
- `lobby:join` - Join lobby
- `game:started` - Game started
- `game:night_action` - Submit night action
- `game:day_vote` - Submit day vote
- `chat:send` - Send chat message

## Environment Variables

### Server (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/mafia
REDIS_URL=redis://localhost:6379
PORT=3000
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### Phase 1: MVP ✅
- [x] Planning & architecture
- [ ] Lobby system
- [ ] Basic game engine
- [ ] Core roles (Mafia, Villager, Doctor, Detective)
- [ ] Text chat
- [ ] Basic UI

### Phase 2: Enhanced Features
- [ ] User accounts & authentication
- [ ] Game history & statistics
- [ ] Additional roles (Jester, Godfather, etc.)
- [ ] Spectator mode
- [ ] Room customization

### Phase 3: Advanced Features
- [ ] Voice chat integration
- [ ] Replay system
- [ ] Achievements
- [ ] Ranked matchmaking
- [ ] Mobile app

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/mafia/issues
- Discord: [Join our server](#)

## Acknowledgments

- Inspired by the classic Mafia party game
- Built with modern web technologies
- Community-driven development

---

**Made with ❤️ by the Mafia Game Team**
