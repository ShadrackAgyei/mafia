import { RoomSettings, MIN_PLAYERS, MAX_PLAYERS } from '../../../shared/types/index.js';

/**
 * Validates player name
 */
export function isValidPlayerName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.trim().length >= 2 &&
    name.trim().length <= 20 &&
    /^[a-zA-Z0-9\s_-]+$/.test(name.trim())
  );
}

/**
 * Validates room settings
 */
export function isValidRoomSettings(settings: Partial<RoomSettings>): boolean {
  if (settings.maxPlayers !== undefined) {
    if (
      !Number.isInteger(settings.maxPlayers) ||
      settings.maxPlayers < MIN_PLAYERS ||
      settings.maxPlayers > MAX_PLAYERS
    ) {
      return false;
    }
  }

  if (settings.nightDuration !== undefined) {
    if (
      !Number.isInteger(settings.nightDuration) ||
      settings.nightDuration < 30 ||
      settings.nightDuration > 120
    ) {
      return false;
    }
  }

  if (settings.dayDuration !== undefined) {
    if (
      !Number.isInteger(settings.dayDuration) ||
      settings.dayDuration < 60 ||
      settings.dayDuration > 300
    ) {
      return false;
    }
  }

  if (settings.votingDuration !== undefined) {
    if (
      !Number.isInteger(settings.votingDuration) ||
      settings.votingDuration < 30 ||
      settings.votingDuration > 60
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes player name (trim and limit length)
 */
export function sanitizePlayerName(name: string): string {
  return name.trim().slice(0, 20);
}
