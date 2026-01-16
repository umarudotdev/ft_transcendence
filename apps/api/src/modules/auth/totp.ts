import { encodeBase32 } from "@oslojs/encoding";
import { createTOTPKeyURI, verifyTOTP } from "@oslojs/otp";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import QRCode from "qrcode";

import { env } from "../../env";

const TOTP_ISSUER = "ft_transcendence";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function getEncryptionKey(): Buffer {
  const keyHex = env.TOTP_ENCRYPTION_KEY;
  if (keyHex) {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) {
      throw new Error("TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
    }
    return key;
  }

  return randomBytes(32);
}

const ENCRYPTION_KEY = getEncryptionKey();
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Generate a new TOTP secret.
 * Returns the raw secret (for storage) and the QR code URL.
 */
export function generateTotpSecret(userEmail: string): {
  secret: Uint8Array;
  keyUri: string;
} {
  const secret = randomBytes(20);

  const keyUri = createTOTPKeyURI(
    TOTP_ISSUER,
    userEmail,
    secret,
    TOTP_PERIOD_SECONDS,
    TOTP_DIGITS
  );

  return { secret, keyUri };
}

/**
 * Verify a TOTP code against a secret.
 * Uses standard 30 second period and 6 digits.
 */
export function verifyTotpCode(secret: Uint8Array, code: string): boolean {
  return verifyTOTP(secret, TOTP_PERIOD_SECONDS, TOTP_DIGITS, code);
}

/**
 * Encrypt a TOTP secret for database storage.
 */
export function encryptSecret(secret: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secret)),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a TOTP secret from database storage.
 */
export function decryptSecret(encryptedSecret: string): Uint8Array {
  const [ivB64, authTagB64, encryptedB64] = encryptedSecret.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return new Uint8Array(decrypted);
}

/**
 * Generate a base32-encoded secret for display to user.
 * This is what they'd manually enter if they can't scan the QR.
 */
export function secretToBase32(secret: Uint8Array): string {
  return encodeBase32(secret);
}

/**
 * Generate a QR code data URL from the key URI.
 */
export async function generateQrCodeDataUrl(keyUri: string): Promise<string> {
  return QRCode.toDataURL(keyUri, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
  });
}
