interface Env {
  API_URL: string;
  NODE_ENV: "development" | "production" | "test";
}

function parseEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (
    nodeEnv !== "development" &&
    nodeEnv !== "production" &&
    nodeEnv !== "test"
  ) {
    throw new Error(
      `Invalid NODE_ENV: ${nodeEnv}. Must be development, production, or test.`
    );
  }

  return {
    API_URL: process.env.API_URL ?? "http://localhost:3000",
    NODE_ENV: nodeEnv,
  };
}

export const env = parseEnv();
