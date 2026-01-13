import { FortyTwo } from "arctic";

// Initialize the 42 OAuth client
// These values come from your 42 API application settings
function createFortyTwoClient(): FortyTwo | null {
  const clientId = process.env.INTRA_CLIENT_ID;
  const clientSecret = process.env.INTRA_CLIENT_SECRET;
  const redirectUri = process.env.INTRA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn(
      "WARNING: 42 OAuth not configured. Set INTRA_CLIENT_ID, INTRA_CLIENT_SECRET, and INTRA_REDIRECT_URI."
    );
    return null;
  }

  return new FortyTwo(clientId, clientSecret, redirectUri);
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
