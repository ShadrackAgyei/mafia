import { create } from 'zustand';
import { Room, Player } from '@shared/types';

interface RoomStore {
  room: Room | null;
  yourPlayerId: string | null;
  isHost: boolean;

  setRoom: (room: Room) => void;
  setYourPlayerId: (playerId: string) => void;
  updatePlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  addPlayer: (player: Player) => void;
  updateSettings: (settings: Partial<Room['settings']>) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  room: null,
  yourPlayerId: null,
  isHost: false,

  setRoom: (room) => {
    const { yourPlayerId } = get();
    const isHost = room.hostId === yourPlayerId;
    set({ room, isHost });
  },

  setYourPlayerId: (playerId) => {
    const { room } = get();
    const isHost = room?.hostId === playerId;
    set({ yourPlayerId, isHost });
  },

  updatePlayer: (player) =>
    set((state) => {
      if (!state.room) return state;

      const players = state.room.players.map((p) =>
        p.id === player.id ? { ...p, ...player } : p
      );

      return {
        room: { ...state.room, players },
      };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      if (!state.room) return state;

      const players = state.room.players.filter((p) => p.id !== playerId);

      return {
        room: { ...state.room, players },
      };
    }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.room) return state;

      const players = [...state.room.players, player];

      return {
        room: { ...state.room, players },
      };
    }),

  updateSettings: (settings) =>
    set((state) => {
      if (!state.room) return state;

      return {
        room: {
          ...state.room,
          settings: { ...state.room.settings, ...settings },
        },
      };
    }),

  reset: () => set({ room: null, yourPlayerId: null, isHost: false }),
}));
