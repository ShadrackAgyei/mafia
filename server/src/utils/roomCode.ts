/**
 * Generates a random 6-character room code
 * Format: ABCDEF (uppercase letters and numbers)
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Validates a room code format
 */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}
