import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const EnvSchema = Type.Object({
  // Database (required)
  DATABASE_URL: Type.String({ minLength: 1 }),

  // Server
  NODE_ENV: Type.Union(
    [
      Type.Literal("development"),
      Type.Literal("production"),
      Type.Literal("test"),
    ],
    { default: "development" }
  ),
  PORT: Type.Number({ default: 3000 }),
  FRONTEND_URL: Type.String({ default: "http://localhost:5173" }),

  // 42 OAuth (optional - OAuth disabled if not set)
  INTRA_CLIENT_ID: Type.Optional(Type.String()),
  INTRA_CLIENT_SECRET: Type.Optional(Type.String()),
  INTRA_REDIRECT_URI: Type.Optional(Type.String()),

  // Security
  TOTP_ENCRYPTION_KEY: Type.Optional(Type.String({ minLength: 32 })),
});

type Env = Static<typeof EnvSchema>;

function parseEnv(): Env {
  const raw: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT ? Number(process.env.PORT) : undefined,
    FRONTEND_URL: process.env.FRONTEND_URL,
    INTRA_CLIENT_ID: process.env.INTRA_CLIENT_ID,
    INTRA_CLIENT_SECRET: process.env.INTRA_CLIENT_SECRET,
    INTRA_REDIRECT_URI: process.env.INTRA_REDIRECT_URI,
    TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY,
  };

  // Remove undefined values so defaults can apply
  for (const key of Object.keys(raw)) {
    if (raw[key] === undefined) {
      delete raw[key];
    }
  }

  // Apply defaults
  const withDefaults = Value.Default(EnvSchema, raw);

  // Validate
  const errors = [...Value.Errors(EnvSchema, withDefaults)];
  if (errors.length > 0) {
    console.error("❌ Invalid environment variables:");
    for (const error of errors) {
      console.error(`  ${error.path}: ${error.message}`);
    }
    process.exit(1);
  }

  const env = withDefaults as Env;

  // Warn about missing optional but recommended vars
  if (
    !env.INTRA_CLIENT_ID ||
    !env.INTRA_CLIENT_SECRET ||
    !env.INTRA_REDIRECT_URI
  ) {
    console.warn(
      "⚠️  OAuth environment variables not set - 42 authentication disabled"
    );
  }

  if (!env.TOTP_ENCRYPTION_KEY && env.NODE_ENV === "production") {
    console.error("❌ TOTP_ENCRYPTION_KEY is required in production");
    process.exit(1);
  }

  if (!env.TOTP_ENCRYPTION_KEY && env.NODE_ENV === "development") {
    console.warn(
      "⚠️  TOTP_ENCRYPTION_KEY not set - using insecure development key"
    );
  }

  return env;
}

export const env = parseEnv();
