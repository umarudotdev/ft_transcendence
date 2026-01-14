import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

/**
 * Hash a password using Argon2id.
 *
 * The result includes the algorithm parameters, salt, and hash.
 * Example: $argon2id$v=19$m=19456,t=2,p=1$...$...
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 *
 * Uses constant-time comparison internally to prevent timing attacks.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

interface PasswordValidation {
  valid: boolean;
  requirements: string[];
}

const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "1234567",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "bailey",
  "shadow",
  "123123",
  "654321",
  "superman",
  "qazwsx",
  "michael",
  "football",
  "password1",
  "password123",
  "welcome",
  "jesus",
  "ninja",
  "mustang",
  "password2",
  "admin",
  "admin123",
  "root",
  "toor",
  "pass",
  "test",
  "guest",
  "hello",
  "changeme",
  "fuck",
  "fuckyou",
]);

/**
 * Validate password strength.
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - Not in common password list
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  const requirements: string[] = [];

  if (password.length < 8) {
    requirements.push("At least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    requirements.push("At least 1 uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    requirements.push("At least 1 lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    requirements.push("At least 1 number");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    requirements.push("Password is too common");
  }

  return {
    valid: requirements.length === 0,
    requirements,
  };
}
