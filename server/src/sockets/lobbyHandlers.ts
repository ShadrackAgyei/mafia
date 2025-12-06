import { Server, Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager.js';
import { GameEngine } from '../services/GameEngine.js';
import { RoleManager } from '../services/RoleManager.js';
import {
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReadyPayload,
  LobbyStartPayload,
  LobbyKickPayload,
  LobbyUpdateSettingsPayload,
  LobbyJoinedData,
  LobbyPlayerJoinedData,
  LobbyPlayerLeftData,
  LobbyPlayerReadyData,
  LobbySettingsUpdatedData,
  LobbyErrorData,
  GameStartedData,
  MIN_PLAYERS,
} from '../../../shared/types/index.js';

/**
 * Setup lobby-related Socket.IO event handlers
 */
export function setupLobbyHandlers(io: Server, socket: Socket): void {
  /**
   * Join a lobby
   */
  socket.on('lobby:join', async (payload: LobbyJoinPayload) => {
    try {
      const { roomCode, playerName, playerId } = payload;

      console.log(`[Lobby] Player ${playerName} (${playerId}) joining room ${roomCode}`);

      // Get room
      const room = await RoomManager.getRoom(roomCode);

      if (!room) {
        socket.emit('lobby:error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        } as LobbyErrorData);
        return;
      }

      // Check if game already started
      if (room.status !== 'waiting') {
        socket.emit('lobby:error', {
          code: 'GAME_IN_PROGRESS',
          message: 'Game already in progress',
        } as LobbyErrorData);
        return;
      }

      // Update player's socket ID
      const updatedRoom = await RoomManager.updatePlayerSocket(roomCode, playerId, socket.id);

      if (!updatedRoom) {
        socket.emit('lobby:error', {
          code: 'PLAYER_NOT_IN_ROOM',
          message: 'Player not found in room',
        } as LobbyErrorData);
        return;
      }

      // Join socket room
      await socket.join(roomCode);

      // Send room data to joining player
      socket.emit('lobby:joined', {
        room: updatedRoom,
        yourPlayerId: playerId,
      } as LobbyJoinedData);

      // Notify other players
      const player = updatedRoom.players.find((p) => p.id === playerId);
      if (player) {
        socket.to(roomCode).emit('lobby:player_joined', {
          player,
          playerCount: updatedRoom.players.length,
        } as LobbyPlayerJoinedData);
      }

      console.log(`[Lobby] Player ${playerName} joined room ${roomCode}`);
    } catch (error: any) {
      console.error('[Lobby] Error joining:', error);
      socket.emit('lobby:error', {
        code: 'SERVER_ERROR',
        message: 'Failed to join lobby',
      } as LobbyErrorData);
    }
  });

  /**
   * Leave a lobby
   */
  socket.on('lobby:leave', async (payload: LobbyLeavePayload) => {
    try {
      const { roomCode } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      console.log(`[Lobby] Player ${player.name} leaving room ${roomCode}`);

      // Remove player
      const updatedRoom = await RoomManager.removePlayer(roomCode, player.id);

      // Leave socket room
      await socket.leave(roomCode);

      // Notify others
      if (updatedRoom) {
        io.to(roomCode).emit('lobby:player_left', {
          playerId: player.id,
          playerName: player.name,
          playerCount: updatedRoom.players.length,
          newHostId: updatedRoom.hostId !== room.hostId ? updatedRoom.hostId : undefined,
        } as LobbyPlayerLeftData);
      }

      console.log(`[Lobby] Player ${player.name} left room ${roomCode}`);
    } catch (error: any) {
      console.error('[Lobby] Error leaving:', error);
    }
  });

  /**
   * Toggle ready status
   */
  socket.on('lobby:ready', async (payload: LobbyReadyPayload) => {
    try {
      const { roomCode, ready } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      console.log(`[Lobby] Player ${player.name} ready: ${ready}`);

      // Update ready status
      const updatedRoom = await RoomManager.updatePlayerReady(roomCode, player.id, ready);
      if (!updatedRoom) return;

      // Check if all ready
      const allReady = RoomManager.areAllPlayersReady(updatedRoom);

      // Notify all players
      io.to(roomCode).emit('lobby:player_ready', {
        playerId: player.id,
        playerName: player.name,
        isReady: ready,
        allReady,
      } as LobbyPlayerReadyData);
    } catch (error: any) {
      console.error('[Lobby] Error toggling ready:', error);
    }
  });

  /**
   * Start game (host only)
   */
  socket.on('lobby:start', async (payload: LobbyStartPayload) => {
    try {
      const { roomCode } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) {
        socket.emit('lobby:error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        } as LobbyErrorData);
        return;
      }

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      // Check if player is host
      if (!RoomManager.isHost(room, player.id)) {
        socket.emit('lobby:error', {
          code: 'NOT_AUTHORIZED',
          message: 'Only the host can start the game',
        } as LobbyErrorData);
        return;
      }

      // Check minimum players
      if (room.players.length < MIN_PLAYERS) {
        socket.emit('lobby:error', {
          code: 'MINIMUM_PLAYERS_NOT_MET',
          message: `Need at least ${MIN_PLAYERS} players to start`,
        } as LobbyErrorData);
        return;
      }

      // Check if all players ready
      if (!RoomManager.areAllPlayersReady(room)) {
        socket.emit('lobby:error', {
          code: 'NOT_ALL_READY',
          message: 'All players must be ready',
        } as LobbyErrorData);
        return;
      }

      console.log(`[Lobby] Starting game in room ${roomCode}`);

      // Update room status
      await RoomManager.updateRoomStatus(roomCode, 'playing');

      // Start game
      const gameState = await GameEngine.startGame(room);

      // Notify each player with their role
      room.players.forEach((p) => {
        const role = gameState.roles[p.id];
        const mafiaMembers = role === 'mafia' ? RoleManager.getMafiaMembers(gameState.roles) : undefined;

        io.to(p.socketId).emit('game:started', {
          gameId: roomCode,
          yourRole: role,
          mafiaMembers,
          totalPlayers: room.players.length,
          startedAt: new Date().toISOString(),
        } as GameStartedData);
      });

      // Schedule auto-transition to night phase
      setTimeout(async () => {
        const currentState = await GameEngine.getGameState(roomCode);
        if (currentState && currentState.phase === 'role_assignment') {
          const newState = await GameEngine.transitionPhase(currentState, room.settings);

          io.to(roomCode).emit('game:phase_changed', {
            phase: newState.phase,
            round: newState.round,
            duration: room.settings.nightDuration,
            endsAt: newState.phaseEndsAt,
          });
        }
      }, 5000); // 5 seconds for role assignment

      console.log(`[Lobby] Game started in room ${roomCode}`);
    } catch (error: any) {
      console.error('[Lobby] Error starting game:', error);
      socket.emit('lobby:error', {
        code: 'SERVER_ERROR',
        message: 'Failed to start game',
      } as LobbyErrorData);
    }
  });

  /**
   * Kick player (host only)
   */
  socket.on('lobby:kick', async (payload: LobbyKickPayload) => {
    try {
      const { roomCode, playerId } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const host = RoomManager.getPlayerBySocket(room, socket.id);
      if (!host) return;

      // Check if requester is host
      if (!RoomManager.isHost(room, host.id)) {
        socket.emit('lobby:error', {
          code: 'NOT_AUTHORIZED',
          message: 'Only the host can kick players',
        } as LobbyErrorData);
        return;
      }

      // Can't kick yourself
      if (playerId === host.id) {
        socket.emit('lobby:error', {
          code: 'INVALID_ACTION',
          message: 'Cannot kick yourself',
        } as LobbyErrorData);
        return;
      }

      const playerToKick = room.players.find((p) => p.id === playerId);
      if (!playerToKick) return;

      console.log(`[Lobby] Host kicking player ${playerToKick.name} from room ${roomCode}`);

      // Notify kicked player
      io.to(playerToKick.socketId).emit('lobby:kicked');

      // Remove player
      const updatedRoom = await RoomManager.removePlayer(roomCode, playerId);

      // Notify others
      if (updatedRoom) {
        io.to(roomCode).emit('lobby:player_left', {
          playerId,
          playerName: playerToKick.name,
          playerCount: updatedRoom.players.length,
        } as LobbyPlayerLeftData);
      }
    } catch (error: any) {
      console.error('[Lobby] Error kicking player:', error);
    }
  });

  /**
   * Update room settings (host only)
   */
  socket.on('lobby:update_settings', async (payload: LobbyUpdateSettingsPayload) => {
    try {
      const { roomCode, settings } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      // Check if player is host
      if (!RoomManager.isHost(room, player.id)) {
        socket.emit('lobby:error', {
          code: 'NOT_AUTHORIZED',
          message: 'Only the host can update settings',
        } as LobbyErrorData);
        return;
      }

      console.log(`[Lobby] Updating settings for room ${roomCode}`);

      // Update settings
      const updatedRoom = await RoomManager.updateSettings(roomCode, settings);
      if (!updatedRoom) return;

      // Notify all players
      io.to(roomCode).emit('lobby:settings_updated', {
        settings: updatedRoom.settings,
      } as LobbySettingsUpdatedData);
    } catch (error: any) {
      console.error('[Lobby] Error updating settings:', error);
    }
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', async () => {
    try {
      // Find rooms this socket is in
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);

      for (const roomCode of rooms) {
        const result = await RoomManager.markPlayerDisconnected(roomCode, socket.id);

        if (result) {
          const { room, player } = result;

          // Notify others
          io.to(roomCode).emit('player:disconnected', {
            playerId: player.id,
            playerName: player.name,
            canReconnect: true,
            timeoutAt: new Date(Date.now() + 60000).toISOString(), // 60s to reconnect
          });

          // If in lobby, auto-remove after timeout
          if (room.status === 'waiting') {
            setTimeout(async () => {
              const currentRoom = await RoomManager.getRoom(roomCode);
              if (currentRoom) {
                const currentPlayer = currentRoom.players.find((p) => p.id === player.id);
                if (currentPlayer && !currentPlayer.isConnected) {
                  const updatedRoom = await RoomManager.removePlayer(roomCode, player.id);

                  if (updatedRoom) {
                    io.to(roomCode).emit('lobby:player_left', {
                      playerId: player.id,
                      playerName: player.name,
                      playerCount: updatedRoom.players.length,
                      newHostId: updatedRoom.hostId !== room.hostId ? updatedRoom.hostId : undefined,
                    } as LobbyPlayerLeftData);
                  }
                }
              }
            }, 60000); // 60 seconds
          }
        }
      }
    } catch (error: any) {
      console.error('[Lobby] Error handling disconnect:', error);
    }
  });
}
