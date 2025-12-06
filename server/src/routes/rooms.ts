import express from 'express';
import { RoomManager } from '../services/RoomManager.js';
import { isValidPlayerName, isValidRoomSettings, sanitizePlayerName } from '../utils/validation.js';
import { isValidRoomCode } from '../utils/roomCode.js';
import {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  GetRoomResponse,
  ErrorResponse,
  DEFAULT_ROOM_SETTINGS,
} from '../../../shared/types/index.js';

const router = express.Router();

/**
 * POST /api/rooms/create
 * Create a new room
 */
router.post('/create', async (req, res) => {
  try {
    const { playerName, settings }: CreateRoomRequest = req.body;

    // Validate player name
    if (!playerName || !isValidPlayerName(playerName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAYER_NAME',
          message: 'Player name must be 2-20 characters (letters, numbers, spaces, _ and -)',
        },
      } as ErrorResponse);
    }

    // Validate settings if provided
    if (settings && !isValidRoomSettings(settings)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SETTINGS',
          message: 'Invalid room settings',
        },
      } as ErrorResponse);
    }

    // Generate host ID
    const hostId = crypto.randomUUID();

    // Create room
    const room = await RoomManager.createRoom(
      hostId,
      sanitizePlayerName(playerName),
      settings || {}
    );

    const response: CreateRoomResponse = {
      roomCode: room.code,
      hostId,
      room,
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('[API] Error creating room:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create room',
      },
    } as ErrorResponse);
  }
});

/**
 * POST /api/rooms/:code/join
 * Join an existing room
 */
router.post('/:code/join', async (req, res) => {
  try {
    const { code } = req.params;
    const { playerName }: JoinRoomRequest = req.body;

    // Validate room code
    if (!isValidRoomCode(code)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROOM_CODE',
          message: 'Invalid room code format',
        },
      } as ErrorResponse);
    }

    // Validate player name
    if (!playerName || !isValidPlayerName(playerName)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAYER_NAME',
          message: 'Player name must be 2-20 characters (letters, numbers, spaces, _ and -)',
        },
      } as ErrorResponse);
    }

    // Check if room exists
    const roomExists = await RoomManager.roomExists(code);
    if (!roomExists) {
      return res.status(404).json({
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        },
      } as ErrorResponse);
    }

    // Add player to room
    try {
      const result = await RoomManager.addPlayer(code, sanitizePlayerName(playerName));

      if (!result) {
        return res.status(404).json({
          error: {
            code: 'ROOM_NOT_FOUND',
            message: 'Room not found',
          },
        } as ErrorResponse);
      }

      const response: JoinRoomResponse = {
        playerId: result.playerId,
        room: result.room,
      };

      res.status(200).json(response);
    } catch (error: any) {
      if (error.message === 'Room is full') {
        return res.status(409).json({
          error: {
            code: 'ROOM_FULL',
            message: 'Room is full',
          },
        } as ErrorResponse);
      }

      if (error.message === 'Game already in progress') {
        return res.status(409).json({
          error: {
            code: 'GAME_IN_PROGRESS',
            message: 'Game already in progress',
          },
        } as ErrorResponse);
      }

      if (error.message === 'Name already taken in this room') {
        return res.status(409).json({
          error: {
            code: 'DUPLICATE_NAME',
            message: 'Name already taken in this room',
          },
        } as ErrorResponse);
      }

      throw error;
    }
  } catch (error: any) {
    console.error('[API] Error joining room:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to join room',
      },
    } as ErrorResponse);
  }
});

/**
 * GET /api/rooms/:code
 * Get room information
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Validate room code
    if (!isValidRoomCode(code)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROOM_CODE',
          message: 'Invalid room code format',
        },
      } as ErrorResponse);
    }

    // Get room
    const room = await RoomManager.getRoom(code);

    if (!room) {
      return res.status(404).json({
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        },
      } as ErrorResponse);
    }

    const host = room.players.find((p) => p.isHost);

    const response: GetRoomResponse = {
      code: room.code,
      status: room.status,
      playerCount: room.players.length,
      maxPlayers: room.settings.maxPlayers,
      hostName: host?.name || 'Unknown',
      createdAt: room.createdAt,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[API] Error getting room:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get room',
      },
    } as ErrorResponse);
  }
});

/**
 * DELETE /api/rooms/:code
 * Delete a room (host only)
 */
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { hostId } = req.body;

    // Validate room code
    if (!isValidRoomCode(code)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROOM_CODE',
          message: 'Invalid room code format',
        },
      } as ErrorResponse);
    }

    // Get room
    const room = await RoomManager.getRoom(code);

    if (!room) {
      return res.status(404).json({
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        },
      } as ErrorResponse);
    }

    // Check if requester is host
    if (room.hostId !== hostId) {
      return res.status(403).json({
        error: {
          code: 'NOT_AUTHORIZED',
          message: 'Only the host can delete the room',
        },
      } as ErrorResponse);
    }

    // Delete room
    await RoomManager.deleteRoom(code);

    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error: any) {
    console.error('[API] Error deleting room:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete room',
      },
    } as ErrorResponse);
  }
});

export default router;
