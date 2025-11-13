/**
 * List of inappropriate substrings to avoid in generated codes
 */
const FORBIDDEN_SUBSTRINGS = [
  'ASS', 'FAG', 'GAY', 'FUX', 'FUK', 'FCK', 'KKK', 'CUM', 
  'JEW', 'SEX', 'JAP', 'WOP', 'DIK', 'DIE', 'COK', 'KOK',
  'TIT', 'VAG', 'PUS', 'SHT', 'DMN', 'HEL', 'NIG', 'RAP',
  'FKN', 'WTF', 'OMG', 'GOD'
];

/**
 * Check if a code contains any forbidden substrings
 */
function containsForbiddenString(code: string): boolean {
  const upperCode = code.toUpperCase();
  return FORBIDDEN_SUBSTRINGS.some(forbidden => upperCode.includes(forbidden));
}

/**
 * Generate a short alphanumeric code (6 characters)
 * Uses current timestamp and random component for uniqueness
 * Filters out codes containing inappropriate substrings
 */
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar-looking: 0,O,1,I
  const maxAttempts = 8; // Prevent infinite loop
  let startPosition;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const timestamp = Date.now().toString(36).toUpperCase();
    // Timestamp will be 8 or 9 characters long
    startPosition = startPosition || timestamp.length - 3;
    // Take last 3 chars from timestamp + 3 random chars
    const timestampPart = timestamp.slice(startPosition, startPosition + 3);
    let randomPart = '';
    
    for (let i = 0; i < 3; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const code = timestampPart + randomPart;
    
    // Check if code is acceptable
    if (!containsForbiddenString(code)) {
      return code;
    }
    
    // If forbidden, move start position backwards
    startPosition = startPosition === 0 ? timestamp.length - 3 : startPosition - 1;
  }
  
  // Fallback: if we somehow can't generate a clean code after many attempts,
  // just return a code with numbers only (very unlikely to be offensive)
  let fallback = '';
  for (let i = 0; i < 6; i++) {
    fallback += '23456789'.charAt(Math.floor(Math.random() * 8));
  }
  return fallback;
}

/**
 * Format a short code for display (e.g., ABC-123)
 */
export function formatShortCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Clean a short code (remove formatting)
 */
export function cleanShortCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

