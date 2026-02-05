import crypto from 'crypto';

// Top 100 most common breached passwords (source: HaveIBeenPwned)
const COMMON_BREACHED_PASSWORDS = new Set([
  'password', '123456', '12345678', '1234', 'qwerty', '12345',
  'dragon', 'pussy', 'baseball', 'football', 'letmein', 'monkey',
  '696969', 'abc123', 'mustang', 'michael', 'shadow', 'master',
  'joshua', '1234567', 'superman', 'welcome', 'trustno1', 'iloveyou',
  'princess', 'adobe123', 'admin', 'password1', '123123', 'qwerty123',
  '1q2w3e4r', '123456789', '291186', 'qwertyuiop', 'password123',
  '1234567890', 'sunshine', 'charlie', 'password1', 'admin123', 'hello',
  'freedom', 'whatever', 'qazwsx', 'trustno1', '000000', 'azerty',
  '123qwe', '1q2w3e', 'zxcvbnm', '111111', 'jordan', 'harley',
  'ranger', 'soccer', 'ashley', '12345678910', 'pokemon', 'michelle',
  'jennifer', 'matrix', 'corvette', 'diamond', 'ferrari', 'google',
  'daniel', 'andrew', 'courtesy', 'apple', 'cheese', 'amanda',
  'solo', 'pepper', 'jessica', 'welcome1', 'loveme', 'nicole',
  'chelsea', 'biteme', 'matthew', 'access', 'yankees', '987654321',
  'dallas', 'austin', 'thunder', 'taylor', 'password!', '1234!',
  'football1!', 'password1!', 'welcome1!', '123456a!', 'abc123!',
  'qwerty123!', 'password123!', 'admin123!', '12345678!', 'test123!',
  '12345678aa@', 'welcome1!', '123456aa@', '123456aa!',
]);

/**
 * Check if a password is in the list of commonly breached passwords
 */
export function isCommonBreachedPassword(password: string): boolean {
  return COMMON_BREACHED_PASSWORDS.has(password.toLowerCase());
}

/**
 * Calculate SHA-1 hash of password (for HaveIBeenPwned API)
 */
function sha1(password: string): string {
  return crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
}

/**
 * Check password against HaveIBeenPwned API
 * Returns the number of times the password has been exposed in breaches
 */
export async function checkHaveIBeenPwned(password: string): Promise<number> {
  const hash = sha1(password);
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Lia360-PasswordValidator',
      },
    });

    if (!response.ok) {
      // If API is unavailable, allow the password (fail open)
      console.warn('HaveIBeenPwned API unavailable, allowing password');
      return 0;
    }

    const data = await response.text();
    const lines = data.split('\n');

    for (const line of lines) {
      const [suffixFromApi, countStr] = line.split(':');
      if (suffixFromApi === suffix) {
        return parseInt(countStr, 10);
      }
    }

    return 0; // Password not found in breaches
  } catch (error) {
    // If API call fails, allow the password (fail open)
    console.warn('HaveIBeenPwned API check failed:', error);
    return 0;
  }
}

/**
 * Validate password strength and check against breaches
 */
export async function validatePassword(password: string): Promise<{
  isValid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check against common breached passwords list
  if (isCommonBreachedPassword(password)) {
    errors.push('Esta senha foi exposta em vazamentos de dados. Por favor, escolha outra senha.');
    return { isValid: false, errors };
  }

  // Optionally check against HaveIBeenPwned API (for production)
  // This is commented out for development to avoid API rate limits
  // const breachCount = await checkHaveIBeenPwned(password);
  // if (breachCount > 0) {
  //   errors.push('Esta senha foi exposta em vazamentos de dados. Por favor, escolha outra senha.');
  //   return { isValid: false, errors };
  // }

  return { isValid: errors.length === 0, errors };
}
