import { FortyTwo } from "arctic";

import { env } from "../../env";

// Initialize the 42 OAuth client
// These values come from your 42 API application settings
function createFortyTwoClient(): FortyTwo | null {
  const { INTRA_CLIENT_ID, INTRA_CLIENT_SECRET, INTRA_REDIRECT_URI } = env;

  if (!INTRA_CLIENT_ID || !INTRA_CLIENT_SECRET || !INTRA_REDIRECT_URI) {
    // Warning is already logged by env.ts
    return null;
  }

  return new FortyTwo(INTRA_CLIENT_ID, INTRA_CLIENT_SECRET, INTRA_REDIRECT_URI);
}

export const fortyTwo = createFortyTwoClient();

// Scopes define what information we can access
// "public" gives us basic profile information
export const OAUTH_SCOPES = ["public"];

// 42 API profile response type
export interface IntraProfile {
  id: number;
  email: string;
  login: string;
  image?: {
    link?: string;
  };
}
