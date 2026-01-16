import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../../env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getKey(): Buffer {
  // CHAT_ENCRYPTION_KEY is validated as required in env.ts
  const keyString = env.CHAT_ENCRYPTION_KEY as string;
  // Use first 32 bytes of the key string
  return Buffer.from(keyString.slice(0, 32), "utf-8");
}

/**
 * Encrypt a message using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptMessage(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf-8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt a message encrypted with encryptMessage
 * Expects format: iv:authTag:ciphertext (all base64)
 */
export function decryptMessage(encrypted: string): string {
  const key = getKey();

  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted message format");
  }

  const [ivBase64, authTagBase64, ciphertext] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;

  // Check if parts look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every((part) => base64Regex.test(part));
}
