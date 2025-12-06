import { redis } from '../server.js';
import {
  ServerGameState,
  GamePhase,
  Role,
  Room,
  RoomSettings,
  GameEvent,
  Winner,
} from '../../../shared/types/index.js';
import { RoleManager } from './RoleManager.js';

/**
 * GameEngine handles all game logic and state management
 */
export class GameEngine {
  private static GAME_PREFIX = 'game:';

  /**
   * Start a new game
   */
  static async startGame(room: Room): Promise<ServerGameState> {
    const playerIds = room.players.map((p) => p.id);

    // Assign roles
    const roles = RoleManager.assignRoles(playerIds);

    // Create initial game state
    const gameState: ServerGameState = {
      roomCode: room.code,
      phase: 'role_assignment',
      round: 0,
      phaseEndsAt: this.calculatePhaseEndTime(5), // 5 seconds for role assignment
      alive: [...playerIds],
      dead: [],
      roles,
      nightActions: {
        mafiaVotes: {},
        doctorSave: null,
        detectiveCheck: null,
      },
      dayVotes: {},
      history: [],
    };

    // Save game state
    await this.saveGameState(gameState);

    // Log event
    this.addEvent(gameState, {
      type: 'phase_change',
      round: 0,
      phase: 'role_assignment',
      timestamp: new Date().toISOString(),
    });

    console.log(`[GameEngine] Started game for room ${room.code}`);
    return gameState;
  }

  /**
   * Get game state
   */
  static async getGameState(roomCode: string): Promise<ServerGameState | null> {
    const key = this.GAME_PREFIX + roomCode;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as ServerGameState;
  }

  /**
   * Save game state
   */
  static async saveGameState(state: ServerGameState): Promise<void> {
    const key = this.GAME_PREFIX + state.roomCode;
    await redis.setEx(key, 7200, JSON.stringify(state)); // 2 hour TTL
  }

  /**
   * Delete game state
   */
  static async deleteGameState(roomCode: string): Promise<void> {
    const key = this.GAME_PREFIX + roomCode;
    await redis.del(key);
  }

  /**
   * Transition to next phase
   */
  static async transitionPhase(
    state: ServerGameState,
    settings: RoomSettings
  ): Promise<ServerGameState> {
    const currentPhase = state.phase;
    let nextPhase: GamePhase;
    let duration: number | null = null;

    switch (currentPhase) {
      case 'role_assignment':
        nextPhase = 'night';
        state.round = 1;
        duration = settings.nightDuration;
        break;

      case 'night':
        nextPhase = 'night_results';
        duration = 3; // 3 seconds to show results
        break;

      case 'night_results':
        nextPhase = 'day_discussion';
        duration = settings.dayDuration;
        break;

      case 'day_discussion':
        nextPhase = 'day_voting';
        duration = settings.votingDuration;
        break;

      case 'day_voting':
        nextPhase = 'day_results';
        duration = 5; // 5 seconds to show results
        break;

      case 'day_results':
        // Check win condition before transitioning
        const winner = this.checkWinCondition(state);
        if (winner) {
          nextPhase = 'game_over';
          duration = null;
        } else {
          nextPhase = 'night';
          state.round++;
          duration = settings.nightDuration;
          // Reset night actions
          state.nightActions = {
            mafiaVotes: {},
            doctorSave: null,
            detectiveCheck: null,
          };
        }
        break;

      case 'game_over':
        // Stay in game over
        return state;

      default:
        throw new Error(`Unknown phase: ${currentPhase}`);
    }

    state.phase = nextPhase;
    state.phaseEndsAt = duration ? this.calculatePhaseEndTime(duration) : null;
    state.dayVotes = {}; // Reset day votes on phase change

    this.addEvent(state, {
      type: 'phase_change',
      round: state.round,
      phase: nextPhase,
      timestamp: new Date().toISOString(),
    });

    await this.saveGameState(state);

    console.log(
      `[GameEngine] Room ${state.roomCode}: ${currentPhase} → ${nextPhase} (Round ${state.round})`
    );

    return state;
  }

  /**
   * Process night actions
   */
  static async processNightActions(state: ServerGameState): Promise<{
    killed: string | null;
    saved: boolean;
  }> {
    const { mafiaVotes, doctorSave } = state.nightActions;

    // Determine mafia target
    const mafiaTarget = this.tallyMafiaVotes(mafiaVotes);

    // Check if doctor saved the target
    const saved = doctorSave === mafiaTarget;

    // If not saved, kill the player
    const killed = mafiaTarget && !saved ? mafiaTarget : null;

    if (killed) {
      this.killPlayer(state, killed);

      this.addEvent(state, {
        type: 'kill',
        round: state.round,
        phase: 'night',
        target: killed,
        result: 'killed',
        timestamp: new Date().toISOString(),
      });
    }

    if (doctorSave) {
      this.addEvent(state, {
        type: 'save',
        round: state.round,
        phase: 'night',
        actor: this.getPlayerByRole(state, 'doctor')?.[0],
        target: doctorSave,
        result: saved ? 'saved_target' : 'saved_different_player',
        timestamp: new Date().toISOString(),
      });
    }

    await this.saveGameState(state);

    return { killed, saved };
  }

  /**
   * Submit night action
   */
  static async submitNightAction(
    state: ServerGameState,
    playerId: string,
    action: 'kill' | 'save' | 'investigate',
    targetId: string
  ): Promise<void> {
    const playerRole = state.roles[playerId];

    // Validate player is alive
    if (!state.alive.includes(playerId)) {
      throw new Error('Dead players cannot perform actions');
    }

    // Validate target is alive
    if (!state.alive.includes(targetId)) {
      throw new Error('Cannot target dead player');
    }

    // Process action based on role
    if (action === 'kill' && playerRole === 'mafia') {
      state.nightActions.mafiaVotes[playerId] = targetId;
    } else if (action === 'save' && playerRole === 'doctor') {
      state.nightActions.doctorSave = targetId;
    } else if (action === 'investigate' && playerRole === 'detective') {
      state.nightActions.detectiveCheck = targetId;
    } else {
      throw new Error('Invalid action for player role');
    }

    await this.saveGameState(state);
  }

  /**
   * Get investigation result (for detective)
   */
  static getInvestigationResult(state: ServerGameState): {
    targetId: string;
    role: Role;
  } | null {
    const targetId = state.nightActions.detectiveCheck;

    if (!targetId) {
      return null;
    }

    return {
      targetId,
      role: state.roles[targetId],
    };
  }

  /**
   * Submit day vote
   */
  static async submitDayVote(
    state: ServerGameState,
    playerId: string,
    targetId: string
  ): Promise<void> {
    // Validate player is alive
    if (!state.alive.includes(playerId)) {
      throw new Error('Dead players cannot vote');
    }

    // Validate target is alive or 'skip'
    if (targetId !== 'skip' && !state.alive.includes(targetId)) {
      throw new Error('Cannot vote for dead player');
    }

    state.dayVotes[playerId] = targetId;

    this.addEvent(state, {
      type: 'vote',
      round: state.round,
      phase: 'day_voting',
      actor: playerId,
      target: targetId,
      timestamp: new Date().toISOString(),
    });

    await this.saveGameState(state);
  }

  /**
   * Process day votes and eliminate player
   */
  static async processDayVotes(state: ServerGameState): Promise<{
    eliminated: string | null;
    votingResults: Record<string, { votes: number; votedBy: string[] }>;
  }> {
    const votingResults = this.tallyVotes(state.dayVotes);
    const eliminated = this.getEliminatedPlayer(votingResults);

    if (eliminated) {
      this.killPlayer(state, eliminated);

      this.addEvent(state, {
        type: 'elimination',
        round: state.round,
        phase: 'day_voting',
        target: eliminated,
        result: 'eliminated_by_vote',
        timestamp: new Date().toISOString(),
      });
    }

    await this.saveGameState(state);

    return { eliminated, votingResults };
  }

  /**
   * Check win condition
   */
  static checkWinCondition(state: ServerGameState): Winner | null {
    const aliveMafia = state.alive.filter((id) => state.roles[id] === 'mafia').length;
    const aliveNonMafia = state.alive.length - aliveMafia;

    // Mafia wins if they equal or outnumber non-mafia
    if (aliveMafia >= aliveNonMafia && aliveMafia > 0) {
      return { team: 'mafia', reason: 'majority' };
    }

    // Villagers win if all mafia are dead
    if (aliveMafia === 0) {
      return { team: 'villagers', reason: 'elimination' };
    }

    return null;
  }

  /**
   * Kill a player
   */
  private static killPlayer(state: ServerGameState, playerId: string): void {
    const index = state.alive.indexOf(playerId);
    if (index > -1) {
      state.alive.splice(index, 1);
      state.dead.push(playerId);
    }
  }

  /**
   * Tally mafia votes to determine target
   */
  private static tallyMafiaVotes(votes: Record<string, string>): string | null {
    if (Object.keys(votes).length === 0) {
      return null;
    }

    const voteCounts: Record<string, number> = {};

    Object.values(votes).forEach((targetId) => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    // Find player with most votes
    let maxVotes = 0;
    let target: string | null = null;
    let isTie = false;

    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        target = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    // No kill if tie
    return isTie ? null : target;
  }

  /**
   * Tally day votes
   */
  private static tallyVotes(votes: Record<string, string>): Record<
    string,
    { votes: number; votedBy: string[] }
  > {
    const results: Record<string, { votes: number; votedBy: string[] }> = {};

    Object.entries(votes).forEach(([voterId, targetId]) => {
      if (!results[targetId]) {
        results[targetId] = { votes: 0, votedBy: [] };
      }
      results[targetId].votes++;
      results[targetId].votedBy.push(voterId);
    });

    return results;
  }

  /**
   * Get eliminated player from voting results
   */
  private static getEliminatedPlayer(
    votingResults: Record<string, { votes: number; votedBy: string[] }>
  ): string | null {
    let maxVotes = 0;
    let eliminated: string | null = null;
    let isTie = false;

    // Skip votes
    const skipVotes = votingResults['skip']?.votes || 0;

    Object.entries(votingResults).forEach(([playerId, result]) => {
      if (playerId === 'skip') return;

      if (result.votes > maxVotes) {
        maxVotes = result.votes;
        eliminated = playerId;
        isTie = false;
      } else if (result.votes === maxVotes && result.votes > 0) {
        isTie = true;
      }
    });

    // No elimination if tie or skip has most votes
    if (isTie || skipVotes >= maxVotes) {
      return null;
    }

    return eliminated;
  }

  /**
   * Get players by role
   */
  private static getPlayerByRole(state: ServerGameState, role: Role): string[] {
    return Object.entries(state.roles)
      .filter(([_, r]) => r === role)
      .map(([playerId]) => playerId);
  }

  /**
   * Calculate phase end time
   */
  private static calculatePhaseEndTime(durationSeconds: number): string {
    const endTime = new Date();
    endTime.setSeconds(endTime.getSeconds() + durationSeconds);
    return endTime.toISOString();
  }

  /**
   * Add event to history
   */
  private static addEvent(state: ServerGameState, event: GameEvent): void {
    state.history.push(event);
  }

  /**
   * Check if all night actions are submitted
   */
  static areAllNightActionsSubmitted(state: ServerGameState): boolean {
    const aliveMafia = state.alive.filter((id) => state.roles[id] === 'mafia');
    const aliveDoctor = state.alive.find((id) => state.roles[id] === 'doctor');
    const aliveDetective = state.alive.find((id) => state.roles[id] === 'detective');

    // Check mafia votes (all mafia must vote)
    const mafiaVoted = aliveMafia.every((id) => state.nightActions.mafiaVotes[id]);

    // Check doctor save (optional - they don't have to save)
    const doctorActed = !aliveDoctor || state.nightActions.doctorSave !== null;

    // Check detective investigation (optional)
    const detectiveActed = !aliveDetective || state.nightActions.detectiveCheck !== null;

    return mafiaVoted && doctorActed && detectiveActed;
  }

  /**
   * Check if all day votes are submitted
   */
  static areAllDayVotesSubmitted(state: ServerGameState): boolean {
    return state.alive.every((playerId) => state.dayVotes[playerId] !== undefined);
  }

  /**
   * Get current vote counts (for live updates)
   */
  static getCurrentVoteCounts(state: ServerGameState): Record<string, number> {
    const counts: Record<string, number> = {};

    Object.values(state.dayVotes).forEach((targetId) => {
      counts[targetId] = (counts[targetId] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get players who have voted
   */
  static getPlayersWhoVoted(state: ServerGameState): string[] {
    return Object.keys(state.dayVotes);
  }
}
