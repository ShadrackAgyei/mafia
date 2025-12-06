import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import roomRoutes from './routes/rooms.js';
import { setupLobbyHandlers } from './sockets/lobbyHandlers.js';
import { setupGameHandlers } from './sockets/gameHandlers.js';
import { setupChatHandlers } from './sockets/chatHandlers.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Initialize database clients
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Redis error handling
redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: redis.isOpen ? 'connected' : 'disconnected',
      database: 'connected', // Will be checked on startup
    }
  });
});

// API Routes
app.use('/api/rooms', roomRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Register socket handlers
  setupLobbyHandlers(io, socket);
  setupGameHandlers(io, socket);
  setupChatHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
    // Handle disconnection (will be implemented in handlers)
  });

  socket.on('error', (error) => {
    console.error(`[Socket] Error on ${socket.id}:`, error);
  });
});

// Export io for use in other modules
export { io };

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('✅ Connected to Redis');

    // Connect to PostgreSQL
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');

    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection verified');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('🚀 Mafia Game Server');
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\n🛑 Shutting down gracefully...');

  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close Socket.IO
  io.close(() => {
    console.log('✅ Socket.IO server closed');
  });

  // Disconnect from databases
  try {
    await prisma.$disconnect();
    console.log('✅ PostgreSQL disconnected');

    await redis.quit();
    console.log('✅ Redis disconnected');

    console.log('👋 Goodbye!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the server
start();
