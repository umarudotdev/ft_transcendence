import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Generate a cryptographically secure random string.
 * Used for session IDs, tokens, etc.
 *
 * @param length - Number of bytes (output is URL-safe base64 encoded)
 */
export function generateSecureToken(length = 32): string {
  // randomBytes is cryptographically secure
  // toString("base64url") is URL-safe (no +, /, =)
  return randomBytes(length).toString("base64url");
}

/**
 * Constant-time string comparison.
 * Prevents timing attacks when comparing tokens.
 *
 * Regular === can leak information through timing:
 * "aaaa" vs "baaa" returns faster than "aaaa" vs "aaab"
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufferA = Buffer.from(a, "utf8");
    const bufferB = Buffer.from(b, "utf8");
    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}
