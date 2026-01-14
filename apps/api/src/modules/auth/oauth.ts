import { FortyTwo } from "arctic";

import { env } from "../../env";

function createFortyTwoClient(): FortyTwo | null {
  const { INTRA_CLIENT_ID, INTRA_CLIENT_SECRET, INTRA_REDIRECT_URI } = env;

  if (!INTRA_CLIENT_ID || !INTRA_CLIENT_SECRET || !INTRA_REDIRECT_URI) {
    return null;
  }

  return new FortyTwo(INTRA_CLIENT_ID, INTRA_CLIENT_SECRET, INTRA_REDIRECT_URI);
}

export const fortyTwo = createFortyTwoClient();

export const OAUTH_SCOPES = ["public"];

export interface IntraProfile {
  id: number;
  email: string;
  login: string;
  image?: {
    link?: string;
  };
}
