import { Server, Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager.js';
import { GameEngine } from '../services/GameEngine.js';
import { ChatMessagePayload, ChatMessageData } from '../../../shared/types/index.js';

/**
 * Setup chat-related Socket.IO event handlers
 */
export function setupChatHandlers(io: Server, socket: Socket): void {
  /**
   * Send a chat message
   */
  socket.on('chat:send', async (payload: ChatMessagePayload) => {
    try {
      const { roomCode, message, isPrivate } = payload;

      // Basic validation
      if (!message || message.trim().length === 0) {
        return;
      }

      if (message.length > 500) {
        return; // Max message length
      }

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      const gameState = await GameEngine.getGameState(roomCode);

      // Determine if player is dead
      const isDead = gameState ? gameState.dead.includes(player.id) : false;

      const chatMessage: ChatMessageData = {
        from: {
          id: player.id,
          name: player.name,
        },
        message: message.trim(),
        timestamp: new Date().toISOString(),
        isPrivate,
        isDead,
      };

      // If private (mafia-only chat)
      if (isPrivate && gameState) {
        const playerRole = gameState.roles[player.id];

        // Only mafia can send private messages
        if (playerRole !== 'mafia') {
          return;
        }

        // Only send to mafia members
        const mafiaMembers = Object.entries(gameState.roles)
          .filter(([_, role]) => role === 'mafia')
          .map(([playerId]) => playerId);

        // Send to all mafia members
        mafiaMembers.forEach((mafiaId) => {
          const mafiaPlayer = room.players.find((p) => p.id === mafiaId);
          if (mafiaPlayer && mafiaPlayer.socketId) {
            io.to(mafiaPlayer.socketId).emit('chat:message', chatMessage);
          }
        });

        console.log(`[Chat] Private mafia message from ${player.name} in room ${roomCode}`);
      } else {
        // Public message - send to everyone in the room
        io.to(roomCode).emit('chat:message', chatMessage);

        console.log(`[Chat] Public message from ${player.name} in room ${roomCode}`);
      }
    } catch (error: any) {
      console.error('[Chat] Error sending message:', error);
    }
  });
}
