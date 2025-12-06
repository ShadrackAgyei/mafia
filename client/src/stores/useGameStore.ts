import { create } from 'zustand';
import { GameState, GamePhase, Role } from '@shared/types';

interface GameStore extends GameState {
  yourRole: Role | null;
  mafiaMembers: string[];
  voteCounts: Record<string, number>;
  hasVoted: string[];
  selectedTarget: string | null;

  setGameState: (state: Partial<GameState>) => void;
  setYourRole: (role: Role) => void;
  setMafiaMembers: (members: string[]) => void;
  setPhase: (phase: GamePhase, endsAt: string | null) => void;
  setVoteCounts: (counts: Record<string, number>, hasVoted: string[]) => void;
  selectTarget: (targetId: string | null) => void;
  addDead: (playerId: string) => void;
  removeDead: (playerId: string) => void;
  reset: () => void;
}

const initialState = {
  phase: 'role_assignment' as GamePhase,
  round: 0,
  phaseEndsAt: null,
  alive: [],
  dead: [],
  yourRole: null,
  mafiaMembers: [],
  voteCounts: {},
  hasVoted: [],
  selectedTarget: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setGameState: (state) => set(state),

  setYourRole: (role) => set({ yourRole: role }),

  setMafiaMembers: (members) => set({ mafiaMembers: members }),

  setPhase: (phase, endsAt) =>
    set({
      phase,
      phaseEndsAt: endsAt,
      selectedTarget: null, // Reset selection on phase change
    }),

  setVoteCounts: (counts, hasVoted) =>
    set({ voteCounts: counts, hasVoted }),

  selectTarget: (targetId) => set({ selectedTarget: targetId }),

  addDead: (playerId) =>
    set((state) => ({
      dead: [...state.dead, playerId],
      alive: state.alive.filter((id) => id !== playerId),
    })),

  removeDead: (playerId) =>
    set((state) => ({
      alive: [...state.alive, playerId],
      dead: state.dead.filter((id) => id !== playerId),
    })),

  reset: () => set(initialState),
}));
