declare global {
  namespace App {
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
  }
}

export {};
