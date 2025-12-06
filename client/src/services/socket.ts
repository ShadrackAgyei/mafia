import { io, Socket } from 'socket.io-client';
import {
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReadyPayload,
  LobbyStartPayload,
  LobbyKickPayload,
  LobbyUpdateSettingsPayload,
  NightActionPayload,
  DayVotePayload,
  ChatMessagePayload,
} from '@shared/types';

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor() {
    this.serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
  }

  connect(): Socket {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      this.socket.on('error', (error) => {
        console.error('[Socket] Error:', error);
      });
    }

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Lobby events
  joinLobby(payload: LobbyJoinPayload): void {
    this.socket?.emit('lobby:join', payload);
  }

  leaveLobby(payload: LobbyLeavePayload): void {
    this.socket?.emit('lobby:leave', payload);
  }

  toggleReady(payload: LobbyReadyPayload): void {
    this.socket?.emit('lobby:ready', payload);
  }

  startGame(payload: LobbyStartPayload): void {
    this.socket?.emit('lobby:start', payload);
  }

  kickPlayer(payload: LobbyKickPayload): void {
    this.socket?.emit('lobby:kick', payload);
  }

  updateSettings(payload: LobbyUpdateSettingsPayload): void {
    this.socket?.emit('lobby:update_settings', payload);
  }

  // Game events
  submitNightAction(payload: NightActionPayload): void {
    this.socket?.emit('game:night_action', payload);
  }

  submitDayVote(payload: DayVotePayload): void {
    this.socket?.emit('game:day_vote', payload);
  }

  // Chat events
  sendMessage(payload: ChatMessagePayload): void {
    this.socket?.emit('chat:send', payload);
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }

  once(event: string, callback: (...args: any[]) => void): void {
    this.socket?.once(event, callback);
  }
}

// Export singleton instance
export const socketService = new SocketService();
