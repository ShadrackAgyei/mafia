import { Role } from '../../../shared/types/index.js';

/**
 * RoleManager handles role assignment and distribution
 */
export class RoleManager {
  /**
   * Assign roles to players based on player count
   * Returns a map of player IDs to roles
   */
  static assignRoles(playerIds: string[]): Record<string, Role> {
    const playerCount = playerIds.length;
    const roles = this.getRoleDistribution(playerCount);

    // Shuffle roles
    const shuffledRoles = this.shuffle([...roles]);

    // Assign roles to players
    const roleMap: Record<string, Role> = {};
    playerIds.forEach((playerId, index) => {
      roleMap[playerId] = shuffledRoles[index];
    });

    console.log(`[RoleManager] Assigned roles for ${playerCount} players:`, {
      mafia: Object.values(roleMap).filter((r) => r === 'mafia').length,
      doctor: Object.values(roleMap).filter((r) => r === 'doctor').length,
      detective: Object.values(roleMap).filter((r) => r === 'detective').length,
      villager: Object.values(roleMap).filter((r) => r === 'villager').length,
    });

    return roleMap;
  }

  /**
   * Get role distribution based on player count
   * Formula: mafiaCount = floor(playerCount / 3)
   */
  private static getRoleDistribution(playerCount: number): Role[] {
    const roles: Role[] = [];

    // Calculate mafia count (roughly 1/3 of players)
    const mafiaCount = Math.floor(playerCount / 3);

    // Add mafia
    for (let i = 0; i < mafiaCount; i++) {
      roles.push('mafia');
    }

    // Add special roles based on player count
    if (playerCount >= 5) {
      roles.push('doctor');
    }

    if (playerCount >= 7) {
      roles.push('detective');
    }

    // Fill remaining with villagers
    while (roles.length < playerCount) {
      roles.push('villager');
    }

    return roles;
  }

  /**
   * Get mafia members from role map
   */
  static getMafiaMembers(roles: Record<string, Role>): string[] {
    return Object.entries(roles)
      .filter(([_, role]) => role === 'mafia')
      .map(([playerId]) => playerId);
  }

  /**
   * Get players by role
   */
  static getPlayersByRole(roles: Record<string, Role>, role: Role): string[] {
    return Object.entries(roles)
      .filter(([_, r]) => r === role)
      .map(([playerId]) => playerId);
  }

  /**
   * Check if player has role
   */
  static hasRole(roles: Record<string, Role>, playerId: string, role: Role): boolean {
    return roles[playerId] === role;
  }

  /**
   * Get role for player
   */
  static getRole(roles: Record<string, Role>, playerId: string): Role | undefined {
    return roles[playerId];
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Get role distribution preview (for testing/UI)
   */
  static getRoleDistributionPreview(playerCount: number): {
    mafia: number;
    doctor: number;
    detective: number;
    villager: number;
  } {
    const roles = this.getRoleDistribution(playerCount);

    return {
      mafia: roles.filter((r) => r === 'mafia').length,
      doctor: roles.filter((r) => r === 'doctor').length,
      detective: roles.filter((r) => r === 'detective').length,
      villager: roles.filter((r) => r === 'villager').length,
    };
  }
}
