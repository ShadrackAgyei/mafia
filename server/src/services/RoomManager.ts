import { redis } from '../server.js';
import {
  Room,
  RoomSettings,
  Player,
  DEFAULT_ROOM_SETTINGS,
} from '../../../shared/types/index.js';
import { generateRoomCode } from '../utils/roomCode.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * RoomManager handles all room-related operations
 * Uses Redis for fast, ephemeral storage
 */
export class RoomManager {
  private static ROOM_PREFIX = 'room:';
  private static ROOM_TTL = 3600; // 1 hour in seconds

  /**
   * Create a new room
   */
  static async createRoom(
    hostId: string,
    hostName: string,
    settings: Partial<RoomSettings> = {}
  ): Promise<Room> {
    // Generate unique room code
    let code = generateRoomCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure code is unique
    while (await this.roomExists(code) && attempts < maxAttempts) {
      code = generateRoomCode();
      attempts++;
    }

    if (attempts === maxAttempts) {
      throw new Error('Failed to generate unique room code');
    }

    // Create room object
    const room: Room = {
      code,
      hostId,
      status: 'waiting',
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        ...settings,
      },
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

    // Save to Redis
    await this.saveRoom(room);

    console.log(`[RoomManager] Created room ${code} with host ${hostName}`);
    return room;
  }

  /**
   * Get a room by code
   */
  static async getRoom(code: string): Promise<Room | null> {
    const key = this.ROOM_PREFIX + code;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as Room;
  }

  /**
   * Save/update a room
   */
  static async saveRoom(room: Room): Promise<void> {
    const key = this.ROOM_PREFIX + room.code;
    await redis.setEx(key, this.ROOM_TTL, JSON.stringify(room));
  }

  /**
   * Delete a room
   */
  static async deleteRoom(code: string): Promise<void> {
    const key = this.ROOM_PREFIX + code;
    await redis.del(key);
    console.log(`[RoomManager] Deleted room ${code}`);
  }

  /**
   * Check if a room exists
   */
  static async roomExists(code: string): Promise<boolean> {
    const key = this.ROOM_PREFIX + code;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Add a player to a room
   */
  static async addPlayer(
    code: string,
    playerName: string
  ): Promise<{ room: Room; playerId: string } | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    // Check if room is full
    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check if game already started
    if (room.status !== 'waiting') {
      throw new Error('Game already in progress');
    }

    // Check if name is already taken
    if (room.players.some((p) => p.name === playerName)) {
      throw new Error('Name already taken in this room');
    }

    // Create new player
    const playerId = uuidv4();
    const player: Player = {
      id: playerId,
      socketId: '',
      name: playerName,
      isReady: false,
      isHost: false,
      isConnected: false,
      isAlive: true,
    };

    room.players.push(player);
    await this.saveRoom(room);

    console.log(`[RoomManager] Player ${playerName} joined room ${code}`);
    return { room, playerId };
  }

  /**
   * Remove a player from a room
   */
  static async removePlayer(code: string, playerId: string): Promise<Room | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex((p) => p.id === playerId);

    if (playerIndex === -1) {
      return room; // Player not in room
    }

    const playerName = room.players[playerIndex].name;
    room.players.splice(playerIndex, 1);

    // If room is empty, delete it
    if (room.players.length === 0) {
      await this.deleteRoom(code);
      return null;
    }

    // Transfer host if needed
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      console.log(`[RoomManager] Transferred host to ${room.players[0].name} in room ${code}`);
    }

    await this.saveRoom(room);
    console.log(`[RoomManager] Player ${playerName} left room ${code}`);

    return room;
  }

  /**
   * Update player's socket ID
   */
  static async updatePlayerSocket(
    code: string,
    playerId: string,
    socketId: string
  ): Promise<Room | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    const player = room.players.find((p) => p.id === playerId);

    if (!player) {
      return null;
    }

    player.socketId = socketId;
    player.isConnected = true;
    await this.saveRoom(room);

    return room;
  }

  /**
   * Update player ready status
   */
  static async updatePlayerReady(
    code: string,
    playerId: string,
    ready: boolean
  ): Promise<Room | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    const player = room.players.find((p) => p.id === playerId);

    if (!player) {
      return null;
    }

    player.isReady = ready;
    await this.saveRoom(room);

    return room;
  }

  /**
   * Update room settings (host only)
   */
  static async updateSettings(
    code: string,
    settings: Partial<RoomSettings>
  ): Promise<Room | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    room.settings = {
      ...room.settings,
      ...settings,
    };

    await this.saveRoom(room);
    console.log(`[RoomManager] Updated settings for room ${code}`);

    return room;
  }

  /**
   * Update room status
   */
  static async updateRoomStatus(
    code: string,
    status: Room['status']
  ): Promise<Room | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    room.status = status;
    await this.saveRoom(room);

    console.log(`[RoomManager] Room ${code} status changed to ${status}`);
    return room;
  }

  /**
   * Check if all players are ready
   */
  static areAllPlayersReady(room: Room): boolean {
    return room.players.every((p) => p.isReady);
  }

  /**
   * Get player by ID
   */
  static getPlayer(room: Room, playerId: string): Player | undefined {
    return room.players.find((p) => p.id === playerId);
  }

  /**
   * Get player by socket ID
   */
  static getPlayerBySocket(room: Room, socketId: string): Player | undefined {
    return room.players.find((p) => p.socketId === socketId);
  }

  /**
   * Check if player is host
   */
  static isHost(room: Room, playerId: string): boolean {
    return room.hostId === playerId;
  }

  /**
   * Mark player as disconnected
   */
  static async markPlayerDisconnected(
    code: string,
    socketId: string
  ): Promise<{ room: Room; player: Player } | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    const player = room.players.find((p) => p.socketId === socketId);

    if (!player) {
      return null;
    }

    player.isConnected = false;
    await this.saveRoom(room);

    console.log(`[RoomManager] Player ${player.name} disconnected from room ${code}`);
    return { room, player };
  }

  /**
   * Reconnect player
   */
  static async reconnectPlayer(
    code: string,
    playerId: string,
    socketId: string
  ): Promise<Room | null> {
    const room = await this.getRoom(code);

    if (!room) {
      return null;
    }

    const player = room.players.find((p) => p.id === playerId);

    if (!player) {
      return null;
    }

    player.socketId = socketId;
    player.isConnected = true;
    await this.saveRoom(room);

    console.log(`[RoomManager] Player ${player.name} reconnected to room ${code}`);
    return room;
  }
}
