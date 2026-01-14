// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user?: {
        id: number;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        emailVerified: boolean;
        twoFactorEnabled: boolean;
        intraId: number | null;
        createdAt: string;
      };
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
