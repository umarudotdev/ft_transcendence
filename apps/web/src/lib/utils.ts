import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

/**
 * Formats a user's display name and username in Discord-style format.
 * Example: "John Doe#johndoe"
 */
export function formatUserDisplay(
  displayName: string,
  username: string
): string {
  return `${displayName}#${username}`;
}

/**
 * Returns just the display name for contexts where username is not needed.
 * Example: chat messages, simple mentions
 */
export function formatDisplayName(displayName: string): string {
  return displayName;
}

/**
 * Returns just the @username for contexts where only username is shown.
 * Example: @mentions, user handles
 */
export function formatUsername(username: string): string {
  return `@${username}`;
}

/**
 * Generates initials from a name (max 2 characters).
 * Example: "John Doe" → "JD", "Alice" → "A"
 */
export function getInitials(name: string): string {
  if (!name || !name.trim()) {
    return "??";
  }

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
