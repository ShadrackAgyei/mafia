// ============================================================================
// SHARED TYPES FOR MAFIA GAME
// Used by both client and server
// ============================================================================

// ----------------------------------------------------------------------------
// Player & Role Types
// ----------------------------------------------------------------------------

export type Role = 'mafia' | 'villager' | 'doctor' | 'detective';

export interface Player {
  id: string;
  socketId: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  isAlive: boolean;
  role?: Role; // Only populated on server, sent to individual players
}

// ----------------------------------------------------------------------------
// Room Types
// ----------------------------------------------------------------------------

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomSettings {
  maxPlayers: number; // 5-15
  nightDuration: number; // seconds (30-120)
  dayDuration: number; // seconds (60-300)
  votingDuration: number; // seconds (30-60)
}

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: Player[];
  createdAt: string; // ISO timestamp
}

// ----------------------------------------------------------------------------
// Game Types
// ----------------------------------------------------------------------------

export type GamePhase =
  | 'role_assignment'
  | 'night'
  | 'night_results'
  | 'day_discussion'
  | 'day_voting'
  | 'day_results'
  | 'game_over';

export interface GameState {
  phase: GamePhase;
  round: number;
  phaseEndsAt: string | null; // ISO timestamp
  alive: string[]; // Player IDs
  dead: string[]; // Player IDs
}

// Server-only state (never sent to clients)
export interface ServerGameState extends GameState {
  roomCode: string;
  roles: Record<string, Role>;
  nightActions: {
    mafiaVotes: Record<string, string>; // mafiaId -> targetId
    doctorSave: string | null;
    detectiveCheck: string | null;
  };
  dayVotes: Record<string, string>; // voterId -> targetId
  history: GameEvent[];
}

export interface GameEvent {
  type: 'kill' | 'save' | 'investigate' | 'vote' | 'elimination' | 'phase_change';
  round: number;
  phase: GamePhase;
  actor?: string; // Player ID
  target?: string; // Player ID
  result?: string;
  timestamp: string; // ISO timestamp
}

// ----------------------------------------------------------------------------
// Socket Event Payloads - Client → Server
// ----------------------------------------------------------------------------

export interface LobbyJoinPayload {
  roomCode: string;
  playerName: string;
  playerId: string;
}

export interface LobbyLeavePayload {
  roomCode: string;
}

export interface LobbyReadyPayload {
  roomCode: string;
  ready: boolean;
}

export interface LobbyStartPayload {
  roomCode: string;
}

export interface LobbyKickPayload {
  roomCode: string;
  playerId: string;
}

export interface LobbyUpdateSettingsPayload {
  roomCode: string;
  settings: RoomSettings;
}

export interface NightActionPayload {
  roomCode: string;
  action: 'kill' | 'save' | 'investigate';
  targetId: string;
}

export interface DayVotePayload {
  roomCode: string;
  targetId: string; // or 'skip'
}

export interface ChatMessagePayload {
  roomCode: string;
  message: string;
  isPrivate: boolean; // true for mafia-only chat
}

// ----------------------------------------------------------------------------
// Socket Event Data - Server → Client
// ----------------------------------------------------------------------------

export interface LobbyJoinedData {
  room: Room;
  yourPlayerId: string;
}

export interface LobbyPlayerJoinedData {
  player: Player;
  playerCount: number;
}

export interface LobbyPlayerLeftData {
  playerId: string;
  playerName: string;
  playerCount: number;
  newHostId?: string;
}

export interface LobbyPlayerReadyData {
  playerId: string;
  playerName: string;
  isReady: boolean;
  allReady: boolean;
}

export interface LobbySettingsUpdatedData {
  settings: RoomSettings;
}

export interface LobbyErrorData {
  code: ErrorCode;
  message: string;
}

export interface GameStartedData {
  gameId: string;
  yourRole: Role;
  mafiaMembers?: string[]; // Only sent if you're mafia
  totalPlayers: number;
  startedAt: string;
}

export interface PhaseChangedData {
  phase: GamePhase;
  round: number;
  duration: number | null; // seconds, null if no timer
  endsAt: string | null; // ISO timestamp
}

export interface ActionSubmittedData {
  action: 'kill' | 'save' | 'investigate';
  targetId: string;
  targetName: string;
}

export interface ActionErrorData {
  code: ErrorCode;
  message: string;
}

export interface NightResultsData {
  killed: {
    playerId: string;
    playerName: string;
    role: Role;
  } | null;
  saved: boolean;
  round: number;
}

export interface InvestigationResultData {
  targetId: string;
  targetName: string;
  role: Role;
}

export interface VoteUpdatedData {
  votes: Record<string, number>; // playerId -> vote count
  hasVoted: string[]; // Player IDs who have voted
  totalVotes: number;
  requiredVotes: number;
}

export interface DayResultsData {
  eliminated: {
    playerId: string;
    playerName: string;
    role: Role;
    votes: number;
  } | null;
  votingResults: Record<
    string,
    {
      votes: number;
      votedBy: string[];
    }
  >;
  round: number;
}

export interface PlayerDiedData {
  playerId: string;
  playerName: string;
  role: Role;
  cause: 'mafia' | 'vote';
  round: number;
  remainingPlayers: number;
}

export interface GameEndedData {
  winner: 'mafia' | 'villagers';
  reason: 'majority' | 'elimination';
  rounds: number;
  duration: number; // seconds
  players: {
    id: string;
    name: string;
    role: Role;
    survived: boolean;
    killedRound?: number;
    killedBy?: 'mafia' | 'vote';
    won: boolean;
  }[];
  mvp?: {
    playerId: string;
    playerName: string;
    reason: string;
  };
}

export interface ChatMessageData {
  from: {
    id: string;
    name: string;
  };
  message: string;
  timestamp: string;
  isPrivate: boolean;
  isDead: boolean;
}

export interface PlayerDisconnectedData {
  playerId: string;
  playerName: string;
  canReconnect: boolean;
  timeoutAt: string; // ISO timestamp
}

export interface PlayerReconnectedData {
  playerId: string;
  playerName: string;
}

export interface GameStateSyncData {
  room: Room;
  game: GameState;
  yourRole: Role;
  mafiaMembers?: string[]; // Only if you're mafia
}

// ----------------------------------------------------------------------------
// Error Codes
// ----------------------------------------------------------------------------

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'INVALID_ACTION'
  | 'INVALID_TARGET'
  | 'ALREADY_DEAD'
  | 'NOT_AUTHORIZED'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'DUPLICATE_NAME'
  | 'INVALID_ROOM_CODE'
  | 'MINIMUM_PLAYERS_NOT_MET'
  | 'NOT_ALL_READY'
  | 'ALREADY_VOTED'
  | 'SERVER_ERROR';

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

export interface CreateRoomRequest {
  playerName: string;
  settings?: Partial<RoomSettings>;
}

export interface CreateRoomResponse {
  roomCode: string;
  hostId: string;
  room: Room;
}

export interface JoinRoomRequest {
  playerName: string;
}

export interface JoinRoomResponse {
  playerId: string;
  room: Room;
}

export interface GetRoomResponse {
  code: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  createdAt: string;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  timesVillager: number;
  timesMafia: number;
  timesDoctor: number;
  timesDetective: number;
  timesKilledNight: number;
  timesVotedOut: number;
  timesSurvived: number;
  correctVotes: number;
  incorrectVotes: number;
}

export interface Winner {
  team: 'mafia' | 'villagers';
  reason: 'majority' | 'elimination';
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 10,
  nightDuration: 60,
  dayDuration: 120,
  votingDuration: 45,
};

export const ROLE_NAMES: Record<Role, string> = {
  mafia: 'Mafia',
  villager: 'Villager',
  doctor: 'Doctor',
  detective: 'Detective',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  mafia: 'Kill one player each night. Win by equaling or outnumbering villagers.',
  villager: 'Vote during the day to eliminate suspects. Win by eliminating all mafia.',
  doctor: 'Save one player from death each night. You can save yourself.',
  detective: 'Investigate one player each night to learn their role.',
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' &&
    ['mafia', 'villager', 'doctor', 'detective'].includes(value)
  );
}

export function isGamePhase(value: unknown): value is GamePhase {
  return (
    typeof value === 'string' &&
    [
      'role_assignment',
      'night',
      'night_results',
      'day_discussion',
      'day_voting',
      'day_results',
      'game_over',
    ].includes(value)
  );
}

export function isRoomStatus(value: unknown): value is RoomStatus {
  return (
    typeof value === 'string' && ['waiting', 'playing', 'finished'].includes(value)
  );
}
