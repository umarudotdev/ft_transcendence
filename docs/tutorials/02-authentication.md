# Tutorial: Authentication System

> **Difficulty:** Advanced **Time:** 6-8 hours **Prerequisites:** Completed
> Tutorial 01, understanding of HTTP cookies, basic security concepts

## What You'll Learn

- Implementing secure password hashing with Argon2id
- Building database-backed sessions for immediate revocation
- Integrating OAuth providers (42 Intra) using Arctic
- Adding TOTP-based two-factor authentication with Oslo
- Preventing common authentication vulnerabilities
- Using neverthrow for type-safe error handling
- Rate limiting and account lockout protection

## Conceptual Overview

Authentication answers the question: "Who are you?" Authorization (covered
later) answers: "What can you do?" This tutorial focuses entirely on
authentication.

### Why Database Sessions Over JWTs?

JWTs (JSON Web Tokens) are popular, but they have a critical limitation: **you
cannot revoke them**. Once issued, a JWT is valid until expiration. If a user
logs out, changes their password, or gets banned, their JWT still works.

Database sessions solve this. Each session is a random ID stored in the
database. To validate:

```
Cookie → Session ID → Database lookup → User exists? → Authorized
```

If you delete the session from the database, the user is immediately logged out.
No waiting for token expiration.

### The Security Layered Defense

Authentication security is like an onion—multiple layers of protection:

```
┌─────────────────────────────────────────────┐
│  Rate Limiting (outer layer)                │
│  ┌─────────────────────────────────────┐    │
│  │  Account Lockout                    │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │  Password Hashing (Argon2id)│    │    │
│  │  │  ┌───────────────────────┐  │    │    │
│  │  │  │  Session Security     │  │    │    │
│  │  │  │  (HttpOnly cookies)   │  │    │    │
│  │  │  └───────────────────────┘  │    │    │
│  │  └─────────────────────────────┘    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

Even if one layer fails, others provide protection.

### Authentication Flows

**Email/Password Flow:**

```
User → Enters credentials → Server verifies hash → Create session → Set cookie
```

**OAuth Flow (42 Intra):**

```
User → Redirect to 42 → User approves → Callback with code → Exchange for token → Fetch profile → Create session
```

**2FA Flow:**

```
User logs in → Server sets "pending 2FA" flag → User enters TOTP code → Server verifies → Full session
```

---

## Phase 1: Database Schema for Auth

### Learning Objective

Design database tables that support multiple authentication methods, sessions,
and security features.

### Understanding the Approach

A well-designed auth schema must support:

- Multiple login methods (email/password, OAuth)
- Session management with expiration
- Token-based flows (email verification, password reset)
- 2FA enrollment

Think of it as building a security vault. The schema is the vault's structure—it
determines what's possible.

### Key Decisions

1. **Why separate token tables?** Password reset and email verification tokens
   have different lifetimes and purposes. Separate tables make cleanup and
   auditing easier.

2. **Why nullable `passwordHash`?** OAuth-only users don't have passwords.
   Making the field nullable supports both auth methods.

3. **Why `intraId` on users?** This links a user to their 42 account for OAuth.
   It's nullable because email/password users won't have one initially.

4. **Why text IDs for sessions/tokens?** Auto-incrementing IDs are guessable.
   Random strings prevent enumeration attacks.

### Implementation Steps

1. Update your schema at `apps/api/src/db/schema.ts`:

```typescript
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// USERS TABLE
// =============================================================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),

    // Primary identifier for email/password auth
    email: text("email").unique().notNull(),

    // Argon2id hash - nullable for OAuth-only users
    passwordHash: text("password_hash"),

    // Has the user verified their email address?
    emailVerified: boolean("email_verified").default(false).notNull(),

    // User-visible name
    displayName: text("display_name").notNull(),

    // Profile picture URL
    avatarUrl: text("avatar_url"),

    // 42 Intra user ID - for OAuth linking
    // Unique because one 42 account = one ft_transcendence account
    intraId: integer("intra_id").unique(),

    // Encrypted TOTP secret for 2FA
    // Stored encrypted, not plain text!
    totpSecret: text("totp_secret"),

    // Is 2FA currently enabled?
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),

    // Account lockout for brute force protection
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index for OAuth lookups
    intraIdIdx: index("users_intra_id_idx").on(table.intraId),
    // Index for email lookups (login)
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

// =============================================================================
// SESSIONS TABLE
// =============================================================================
export const sessions = pgTable(
  "sessions",
  {
    // Cryptographically random ID (not auto-increment!)
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // When this session becomes invalid
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index for user's sessions (logout all)
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
    // Index for cleanup job
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

// =============================================================================
// EMAIL VERIFICATION TOKENS
// =============================================================================
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  // Random token sent in verification email
  id: text("id").primaryKey(),

  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // 24 hours from creation
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// =============================================================================
// PASSWORD RESET TOKENS
// =============================================================================
export const passwordResetTokens = pgTable("password_reset_tokens", {
  // Random token sent in reset email
  id: text("id").primaryKey(),

  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // 1 hour from creation (shorter for security)
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// =============================================================================
// RELATIONS
// =============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
```

> **Warning:** The `totpSecret` field stores encrypted data. Never store TOTP
> secrets in plain text. We'll cover encryption in Phase 4.

2. Generate and apply the migration:

```bash
cd apps/api
bun run generate
bun run migrate
```

### Checkpoint

After this phase:

- Migration files exist in `drizzle/`
- Database has `users`, `sessions`, `email_verification_tokens`,
  `password_reset_tokens` tables
- You can explain why each field exists and its security purpose

### Common Pitfalls

- **Using auto-increment for session IDs**. Attackers could guess valid session
  IDs. Always use random strings.
- **Forgetting indexes**. Without them, login and session validation become slow
  as data grows.
- **Storing TOTP secrets in plain text**. They must be encrypted at rest.

---

## Phase 2: Auth Repository

### Learning Objective

Create a clean data access layer that handles all database operations for
authentication.

### Understanding the Approach

The repository pattern isolates database logic. Controllers never touch the
database directly. This makes testing easier (you can mock the repository) and
keeps concerns separated.

Think of the repository as a translator: it speaks "database" on one side and
"domain objects" on the other.

### Key Decisions

1. **Why generate IDs in the repository?** The repository is the single source
   of truth for data persistence. Generating IDs here ensures consistency.

2. **Why separate methods for each operation?** Small, focused methods are
   easier to test and understand than large multipurpose ones.

3. **Why return `null` instead of throwing?** Throwing makes error handling
   verbose. Returning `null` for "not found" cases is idiomatic and the service
   can decide what to do.

### Implementation Steps

1. Create crypto utilities at `apps/api/src/common/crypto.ts`:

```typescript
import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random string.
 * Used for session IDs, tokens, etc.
 *
 * @param length - Number of bytes (output is 2x in hex)
 */
export function generateSecureToken(length = 32): string {
  // randomBytes is cryptographically secure
  // toString("base64url") is URL-safe (no +, /, =)
  return randomBytes(length).toString("base64url");
}

/**
 * Constant-time string comparison.
 * Prevents timing attacks when comparing tokens.
 *
 * Regular === can leak information through timing:
 * "aaaa" vs "baaa" returns faster than "aaaa" vs "aaab"
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR accumulates differences without short-circuiting
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
```

> **Pro tip:** Never use `===` to compare secrets. Use constant-time comparison
> to prevent timing attacks.

2. Create the auth repository at `apps/api/src/modules/auth/auth.repository.ts`:

```typescript
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../../db";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  users,
} from "../../db/schema";
import { generateSecureToken } from "../../common/crypto";

// =============================================================================
// USER OPERATIONS
// =============================================================================

export const authRepository = {
  // ---------------------------------------------------------------------------
  // User Queries
  // ---------------------------------------------------------------------------

  async findUserById(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  async findUserByEmail(email: string) {
    // Normalize email to lowercase for case-insensitive matching
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
  },

  async findUserByIntraId(intraId: number) {
    return db.query.users.findFirst({
      where: eq(users.intraId, intraId),
    });
  },

  // ---------------------------------------------------------------------------
  // User Mutations
  // ---------------------------------------------------------------------------

  async createUser(data: {
    email: string;
    passwordHash?: string;
    displayName: string;
    intraId?: number;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        intraId: data.intraId,
        // OAuth users are pre-verified (we trust the provider)
        emailVerified: data.intraId !== undefined,
      })
      .returning();

    return user;
  },

  async updatePassword(userId: number, passwordHash: string) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async updateEmailVerified(userId: number, verified: boolean) {
    const [updated] = await db
      .update(users)
      .set({
        emailVerified: verified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async linkIntraAccount(userId: number, intraId: number) {
    const [updated] = await db
      .update(users)
      .set({
        intraId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async updateTotpSecret(
    userId: number,
    secret: string | null,
    enabled: boolean,
  ) {
    const [updated] = await db
      .update(users)
      .set({
        totpSecret: secret,
        twoFactorEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  // ---------------------------------------------------------------------------
  // Account Lockout
  // ---------------------------------------------------------------------------

  async incrementFailedLogins(userId: number) {
    const user = await this.findUserById(userId);
    if (!user) return null;

    const newCount = user.failedLoginAttempts + 1;

    // Lock account after 10 failed attempts for 15 minutes
    const lockUntil = newCount >= 10
      ? new Date(Date.now() + 15 * 60 * 1000)
      : null;

    const [updated] = await db
      .update(users)
      .set({
        failedLoginAttempts: newCount,
        lockedUntil: lockUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async resetFailedLogins(userId: number) {
    const [updated] = await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  // ---------------------------------------------------------------------------
  // Session Operations
  // ---------------------------------------------------------------------------

  async createSession(userId: number, expiresAt: Date) {
    const id = generateSecureToken(32);

    const [session] = await db
      .insert(sessions)
      .values({
        id,
        userId,
        expiresAt,
      })
      .returning();

    return session;
  },

  async findSessionById(sessionId: string) {
    return db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        user: true,
      },
    });
  },

  async deleteSession(sessionId: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },

  async deleteAllUserSessions(userId: number) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  },

  async deleteExpiredSessions() {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  },

  // ---------------------------------------------------------------------------
  // Email Verification Tokens
  // ---------------------------------------------------------------------------

  async createEmailVerificationToken(userId: number, expiresAt: Date) {
    // Delete any existing tokens for this user first
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    const id = generateSecureToken(32);

    const [token] = await db
      .insert(emailVerificationTokens)
      .values({
        id,
        userId,
        expiresAt,
      })
      .returning();

    return token;
  },

  async findEmailVerificationToken(tokenId: string) {
    return db.query.emailVerificationTokens.findFirst({
      where: eq(emailVerificationTokens.id, tokenId),
    });
  },

  async deleteEmailVerificationToken(tokenId: string) {
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, tokenId));
  },

  // ---------------------------------------------------------------------------
  // Password Reset Tokens
  // ---------------------------------------------------------------------------

  async createPasswordResetToken(userId: number, expiresAt: Date) {
    // Delete any existing tokens for this user first
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    const id = generateSecureToken(32);

    const [token] = await db
      .insert(passwordResetTokens)
      .values({
        id,
        userId,
        expiresAt,
      })
      .returning();

    return token;
  },

  async findPasswordResetToken(tokenId: string) {
    return db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.id, tokenId),
    });
  },

  async deletePasswordResetToken(tokenId: string) {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenId));
  },
};
```

### Checkpoint

After this phase:

- `auth.repository.ts` compiles without errors
- All CRUD operations for users, sessions, and tokens are implemented
- Email is normalized to lowercase in all queries

### Common Pitfalls

- **Not normalizing email case**. Users enter `John@Example.com` and
  `john@example.com` expecting the same account. Always lowercase.
- **Returning sensitive fields**. Consider excluding `passwordHash` and
  `totpSecret` from most queries.
- **Forgetting to delete old tokens**. Without cleanup, token tables grow
  indefinitely.

---

## Phase 3: Auth Service with Password Hashing

### Learning Objective

Implement secure password hashing and business logic using neverthrow for
type-safe error handling.

### Understanding the Approach

The service layer contains all business logic. It's framework-agnostic—no Elysia
imports allowed. This makes the code reusable and testable.

**Argon2id** is the recommended password hashing algorithm (OWASP 2023). It's
designed to be:

- Memory-hard (resistant to GPU attacks)
- Time-hard (slow to compute)
- Resistant to side-channel attacks

**neverthrow** provides `Result<T, E>` types. Instead of throwing exceptions,
functions return either `Ok(value)` or `Err(error)`. This makes error handling
explicit and type-safe.

### Key Decisions

1. **Why Argon2id over bcrypt?** Argon2id won the Password Hashing Competition.
   It's memory-hard, making GPU attacks expensive. Bcrypt is good, but Argon2id
   is better.

2. **Why neverthrow?** Thrown exceptions are invisible in types.
   `Result<User, Error>` explicitly shows what can fail. The compiler forces you
   to handle errors.

3. **Why generic error messages?** "Invalid credentials" doesn't tell attackers
   whether the email exists. Specific messages like "user not found" enable
   enumeration attacks.

### Implementation Steps

1. Install dependencies:

```bash
cd apps/api
bun add @node-rs/argon2 neverthrow
```

2. Create error types at `apps/api/src/modules/auth/auth.errors.ts`:

```typescript
// =============================================================================
// Auth Error Types
// =============================================================================

// Using discriminated unions for type-safe error handling
// Each error has a `type` field that TypeScript can narrow on

export type RegisterError =
  | { type: "EMAIL_EXISTS" }
  | { type: "WEAK_PASSWORD"; requirements: string[] };

export type LoginError =
  | { type: "INVALID_CREDENTIALS" } // Generic - prevents email enumeration
  | { type: "EMAIL_NOT_VERIFIED" }
  | { type: "ACCOUNT_LOCKED"; unlockAt: Date }
  | { type: "REQUIRES_2FA"; sessionId: string }; // Partial session pending 2FA

export type PasswordError =
  | { type: "INCORRECT_PASSWORD" }
  | { type: "WEAK_PASSWORD"; requirements: string[] }
  | { type: "SAME_AS_CURRENT" };

export type TokenError = { type: "INVALID_TOKEN" } | { type: "EXPIRED_TOKEN" };

export type OAuthError =
  | { type: "INVALID_STATE" }
  | { type: "TOKEN_EXCHANGE_FAILED" }
  | { type: "PROFILE_FETCH_FAILED" }
  | { type: "ACCOUNT_ALREADY_LINKED" };

export type SessionError = { type: "NOT_FOUND" } | { type: "EXPIRED" };

export type TotpError =
  | { type: "INVALID_CODE" }
  | { type: "ALREADY_ENABLED" }
  | { type: "NOT_ENABLED" };
```

3. Create password utilities at `apps/api/src/modules/auth/password.ts`:

```typescript
import { hash, verify } from "@node-rs/argon2";

// OWASP recommended settings for Argon2id
// These values balance security and performance
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB - makes GPU attacks expensive
  timeCost: 2, // Number of iterations
  parallelism: 1, // Single-threaded (adjust based on server)
  outputLen: 32, // Output hash length in bytes
};

/**
 * Hash a password using Argon2id.
 *
 * The result includes the algorithm parameters, salt, and hash.
 * Example: $argon2id$v=19$m=19456,t=2,p=1$...$...
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 *
 * Uses constant-time comparison internally to prevent timing attacks.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    // Invalid hash format
    return false;
  }
}

// =============================================================================
// Password Strength Validation
// =============================================================================

interface PasswordValidation {
  valid: boolean;
  requirements: string[];
}

/**
 * Validate password strength.
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  const requirements: string[] = [];

  if (password.length < 8) {
    requirements.push("At least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    requirements.push("At least 1 uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    requirements.push("At least 1 lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    requirements.push("At least 1 number");
  }

  return {
    valid: requirements.length === 0,
    requirements,
  };
}
```

4. Create the auth service at `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";
import { authRepository } from "./auth.repository";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "./password";
import type {
  LoginError,
  PasswordError,
  RegisterError,
  SessionError,
  TokenError,
} from "./auth.errors";

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Token durations
const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// User type for service responses (excludes sensitive fields)
// =============================================================================

interface SafeUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

function toSafeUser(user: {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
  };
}

// =============================================================================
// Auth Service
// =============================================================================

export const authService = {
  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  register(data: {
    email: string;
    password: string;
    displayName: string;
  }): ResultAsync<{ user: SafeUser }, RegisterError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Check if email already exists
        const existing = await authRepository.findUserByEmail(data.email);
        if (existing) {
          return err({ type: "EMAIL_EXISTS" as const });
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(data.password);
        if (!passwordValidation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: passwordValidation.requirements,
          });
        }

        // Hash the password
        const passwordHash = await hashPassword(data.password);

        // Create the user
        const user = await authRepository.createUser({
          email: data.email,
          passwordHash,
          displayName: data.displayName,
        });

        // Create email verification token
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_DURATION_MS);
        const token = await authRepository.createEmailVerificationToken(
          user.id,
          expiresAt,
        );

        // TODO: Send verification email with token.id
        console.log(`Verification token for ${user.email}: ${token.id}`);

        return ok({ user: toSafeUser(user) });
      })(),
      () => ({ type: "EMAIL_EXISTS" as const }), // Fallback error
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  login(
    email: string,
    password: string,
  ): ResultAsync<
    { sessionId: string; user: SafeUser; requires2fa: boolean },
    LoginError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        // Find user by email
        const user = await authRepository.findUserByEmail(email);

        // Generic error if user not found (prevents email enumeration)
        if (!user) {
          // Still hash to prevent timing attacks
          await hashPassword(password);
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return err({
            type: "ACCOUNT_LOCKED" as const,
            unlockAt: user.lockedUntil,
          });
        }

        // OAuth-only users don't have passwords
        if (!user.passwordHash) {
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        // Verify password
        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
          // Increment failed attempts
          await authRepository.incrementFailedLogins(user.id);
          return err({ type: "INVALID_CREDENTIALS" as const });
        }

        // Reset failed login counter on success
        await authRepository.resetFailedLogins(user.id);

        // Check if email is verified
        if (!user.emailVerified) {
          return err({ type: "EMAIL_NOT_VERIFIED" as const });
        }

        // Create session
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user.id, expiresAt);

        // If 2FA is enabled, return partial session
        if (user.twoFactorEnabled) {
          return ok({
            sessionId: session.id,
            user: toSafeUser(user),
            requires2fa: true,
          });
        }

        return ok({
          sessionId: session.id,
          user: toSafeUser(user),
          requires2fa: false,
        });
      })(),
      () => ({ type: "INVALID_CREDENTIALS" as const }),
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Session Validation
  // ---------------------------------------------------------------------------

  validateSession(sessionId: string): ResultAsync<SafeUser, SessionError> {
    return ResultAsync.fromPromise(
      (async () => {
        const session = await authRepository.findSessionById(sessionId);

        if (!session) {
          return err({ type: "NOT_FOUND" as const });
        }

        if (session.expiresAt < new Date()) {
          // Clean up expired session
          await authRepository.deleteSession(sessionId);
          return err({ type: "EXPIRED" as const });
        }

        return ok(toSafeUser(session.user));
      })(),
      () => ({ type: "NOT_FOUND" as const }),
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  logout(sessionId: string): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      authRepository.deleteSession(sessionId),
      () => undefined as never, // logout never fails
    ).map(() => undefined);
  },

  logoutAllDevices(userId: number): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      authRepository.deleteAllUserSessions(userId),
      () => undefined as never,
    ).map(() => undefined);
  },

  // ---------------------------------------------------------------------------
  // Email Verification
  // ---------------------------------------------------------------------------

  verifyEmail(tokenId: string): ResultAsync<void, TokenError> {
    return ResultAsync.fromPromise(
      (async () => {
        const token = await authRepository.findEmailVerificationToken(tokenId);

        if (!token) {
          return err({ type: "INVALID_TOKEN" as const });
        }

        if (token.expiresAt < new Date()) {
          await authRepository.deleteEmailVerificationToken(tokenId);
          return err({ type: "EXPIRED_TOKEN" as const });
        }

        // Mark email as verified
        await authRepository.updateEmailVerified(token.userId, true);

        // Delete the used token
        await authRepository.deleteEmailVerificationToken(tokenId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_TOKEN" as const }),
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Password Reset
  // ---------------------------------------------------------------------------

  requestPasswordReset(email: string): ResultAsync<void, never> {
    // Always returns success to prevent email enumeration
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserByEmail(email);

        if (user) {
          const expiresAt = new Date(Date.now() + PASSWORD_RESET_DURATION_MS);
          const token = await authRepository.createPasswordResetToken(
            user.id,
            expiresAt,
          );

          // TODO: Send password reset email with token.id
          console.log(`Password reset token for ${email}: ${token.id}`);
        }

        // Always return success (even if user doesn't exist)
        return ok(undefined);
      })(),
      () => undefined as never,
    ).andThen((result) => result);
  },

  resetPassword(
    tokenId: string,
    newPassword: string,
  ): ResultAsync<void, TokenError | PasswordError> {
    return ResultAsync.fromPromise(
      (async () => {
        const token = await authRepository.findPasswordResetToken(tokenId);

        if (!token) {
          return err({ type: "INVALID_TOKEN" as const });
        }

        if (token.expiresAt < new Date()) {
          await authRepository.deletePasswordResetToken(tokenId);
          return err({ type: "EXPIRED_TOKEN" as const });
        }

        // Validate new password strength
        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: validation.requirements,
          });
        }

        // Hash and update password
        const passwordHash = await hashPassword(newPassword);
        await authRepository.updatePassword(token.userId, passwordHash);

        // Invalidate all existing sessions (security measure)
        await authRepository.deleteAllUserSessions(token.userId);

        // Delete the used token
        await authRepository.deletePasswordResetToken(tokenId);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_TOKEN" as const }),
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Change Password (for logged-in users)
  // ---------------------------------------------------------------------------

  changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): ResultAsync<void, PasswordError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.passwordHash) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        // Verify current password
        const valid = await verifyPassword(currentPassword, user.passwordHash);
        if (!valid) {
          return err({ type: "INCORRECT_PASSWORD" as const });
        }

        // Check new password strength
        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
          return err({
            type: "WEAK_PASSWORD" as const,
            requirements: validation.requirements,
          });
        }

        // Check if new password is same as current
        const sameAsCurrent = await verifyPassword(
          newPassword,
          user.passwordHash,
        );
        if (sameAsCurrent) {
          return err({ type: "SAME_AS_CURRENT" as const });
        }

        // Update password
        const passwordHash = await hashPassword(newPassword);
        await authRepository.updatePassword(userId, passwordHash);

        // Invalidate all other sessions
        await authRepository.deleteAllUserSessions(userId);

        return ok(undefined);
      })(),
      () => ({ type: "INCORRECT_PASSWORD" as const }),
    ).andThen((result) => result);
  },
};
```

### Checkpoint

After this phase:

- Password hashing works with Argon2id
- Registration checks for existing emails and password strength
- Login handles account lockout and returns appropriate errors
- All service methods return `ResultAsync` types

### Common Pitfalls

- **Revealing whether an email exists**. Login and password reset must give
  generic responses.
- **Not hashing on invalid user lookup**. Without the dummy hash, timing reveals
  if the email exists.
- **Forgetting to invalidate sessions on password change**. This is a critical
  security measure.

---

## Phase 4: Auth Controller with Rate Limiting

### Learning Objective

Expose authentication endpoints with proper validation, error handling, and rate
limiting.

### Understanding the Approach

Controllers are the HTTP interface. They:

1. Validate incoming requests (TypeBox)
2. Call service methods
3. Map errors to HTTP status codes
4. Set cookies and headers

Rate limiting prevents brute force attacks. We use Elysia's plugin system to
create middleware that tracks requests per IP.

### Key Decisions

1. **Why HttpOnly cookies?** JavaScript cannot access HttpOnly cookies,
   preventing XSS attacks from stealing sessions.

2. **Why SameSite=Lax?** This prevents CSRF attacks while allowing normal
   navigation. Links from external sites can access the session, but form
   submissions cannot.

3. **Why map service errors to HTTP codes?** Services don't know about HTTP.
   Controllers translate domain errors to appropriate HTTP responses.

### Implementation Steps

1. Create a rate limiting plugin at `apps/api/src/common/plugins/rate-limit.ts`:

```typescript
import { Elysia } from "elysia";

interface RateLimitConfig {
  max: number; // Maximum requests
  window: number; // Time window in milliseconds
}

// Simple in-memory rate limiter
// In production, use Redis for distributed environments
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  return new Elysia({ name: "rate-limit" }).derive(({ request, error }) => {
    // Get client IP (handle proxies in production)
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const key = `${ip}:${request.url}`;
    const now = Date.now();

    let record = requestCounts.get(key);

    // Reset if window expired
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + config.window };
      requestCounts.set(key, record);
    }

    record.count++;

    // Check if over limit
    if (record.count > config.max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return error(429, {
        message: "Too many requests",
        retryAfter,
      });
    }

    return {};
  });
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60_000); // Every minute
```

2. Create the auth guard at `apps/api/src/common/guards/auth.guard.ts`:

```typescript
import { Elysia } from "elysia";
import { authService } from "../../modules/auth/auth.service";

export const authGuard = new Elysia({ name: "auth-guard" }).derive(
  async ({ cookie, error }) => {
    const sessionId = cookie.session?.value;

    if (!sessionId) {
      return error(401, { message: "Authentication required" });
    }

    const result = await authService.validateSession(sessionId);

    if (result.isErr()) {
      // Clear invalid session cookie
      cookie.session.remove();

      const err = result.error;
      if (err.type === "EXPIRED") {
        return error(401, { message: "Session expired" });
      }
      return error(401, { message: "Invalid session" });
    }

    // Add user to context
    return { user: result.value };
  },
);
```

3. Create the auth controller at `apps/api/src/modules/auth/auth.controller.ts`:

```typescript
import { Elysia, t } from "elysia";
import { authService } from "./auth.service";
import { authGuard } from "../../common/guards/auth.guard";
import { rateLimit } from "../../common/plugins/rate-limit";

// Cookie configuration for sessions
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true, // Not accessible via JavaScript
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax" as const, // CSRF protection
  path: "/", // Available on all paths
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export const authController = new Elysia({ prefix: "/auth" })
  // ---------------------------------------------------------------------------
  // Registration (rate limited: 3/hour)
  // ---------------------------------------------------------------------------
  .use(
    rateLimit({ max: 3, window: 60 * 60 * 1000 }).guard({}, (app) =>
      app.post(
        "/register",
        async ({ body, error }) => {
          const result = await authService.register(body);

          if (result.isErr()) {
            const err = result.error;
            switch (err.type) {
              case "EMAIL_EXISTS":
                return error(409, { message: "Email already registered" });
              case "WEAK_PASSWORD":
                return error(400, {
                  message: "Password too weak",
                  requirements: err.requirements,
                });
            }
          }

          return {
            message: "Registration successful. Please verify your email.",
            user: result.value.user,
          };
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
            password: t.String({ minLength: 8 }),
            displayName: t.String({ minLength: 3, maxLength: 30 }),
          }),
        },
      )),
  )
  // ---------------------------------------------------------------------------
  // Login (rate limited: 5/15min)
  // ---------------------------------------------------------------------------
  .use(
    rateLimit({ max: 5, window: 15 * 60 * 1000 }).guard({}, (app) =>
      app.post(
        "/login",
        async ({ body, cookie, error }) => {
          const result = await authService.login(body.email, body.password);

          if (result.isErr()) {
            const err = result.error;
            switch (err.type) {
              case "INVALID_CREDENTIALS":
                return error(401, { message: "Invalid email or password" });
              case "EMAIL_NOT_VERIFIED":
                return error(403, {
                  message: "Please verify your email before logging in",
                });
              case "ACCOUNT_LOCKED":
                return error(423, {
                  message: "Account locked due to too many failed attempts",
                  unlockAt: err.unlockAt.toISOString(),
                });
              case "REQUIRES_2FA":
                // Set a temporary session cookie
                cookie.session.set({
                  value: err.sessionId,
                  ...SESSION_COOKIE_OPTIONS,
                });
                return {
                  message: "2FA required",
                  requires2fa: true,
                };
            }
          }

          const { sessionId, user, requires2fa } = result.value;

          // Set session cookie
          cookie.session.set({
            value: sessionId,
            ...SESSION_COOKIE_OPTIONS,
          });

          return {
            message: "Login successful",
            user,
            requires2fa,
          };
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
            password: t.String({ minLength: 1 }),
          }),
        },
      )),
  )
  // ---------------------------------------------------------------------------
  // Email Verification
  // ---------------------------------------------------------------------------
  .post(
    "/verify-email",
    async ({ body, error }) => {
      const result = await authService.verifyEmail(body.token);

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INVALID_TOKEN":
            return error(400, { message: "Invalid verification token" });
          case "EXPIRED_TOKEN":
            return error(400, { message: "Verification token has expired" });
        }
      }

      return { message: "Email verified successfully" };
    },
    {
      body: t.Object({
        token: t.String(),
      }),
    },
  )
  // ---------------------------------------------------------------------------
  // Forgot Password (rate limited: 3/hour)
  // ---------------------------------------------------------------------------
  .use(
    rateLimit({ max: 3, window: 60 * 60 * 1000 }).guard({}, (app) =>
      app.post(
        "/forgot-password",
        async ({ body }) => {
          // Always returns success to prevent email enumeration
          await authService.requestPasswordReset(body.email);
          return {
            message:
              "If an account exists, a password reset email has been sent",
          };
        },
        {
          body: t.Object({
            email: t.String({ format: "email" }),
          }),
        },
      )),
  )
  // ---------------------------------------------------------------------------
  // Reset Password
  // ---------------------------------------------------------------------------
  .post(
    "/reset-password",
    async ({ body, error }) => {
      const result = await authService.resetPassword(body.token, body.password);

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INVALID_TOKEN":
            return error(400, { message: "Invalid or expired reset token" });
          case "EXPIRED_TOKEN":
            return error(400, { message: "Reset token has expired" });
          case "WEAK_PASSWORD":
            return error(400, {
              message: "Password too weak",
              requirements: err.requirements,
            });
        }
      }

      return { message: "Password reset successfully" };
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String({ minLength: 8 }),
      }),
    },
  )
  // ---------------------------------------------------------------------------
  // Get Current User (protected)
  // ---------------------------------------------------------------------------
  .use(authGuard)
  .get("/me", ({ user }) => {
    return { user };
  })
  // ---------------------------------------------------------------------------
  // Logout (protected)
  // ---------------------------------------------------------------------------
  .post("/logout", async ({ cookie }) => {
    const sessionId = cookie.session?.value;
    if (sessionId) {
      await authService.logout(sessionId);
    }
    cookie.session.remove();
    return { message: "Logged out successfully" };
  })
  // ---------------------------------------------------------------------------
  // Logout All Devices (protected)
  // ---------------------------------------------------------------------------
  .post("/logout-all", async ({ user, cookie }) => {
    await authService.logoutAllDevices(user.id);
    cookie.session.remove();
    return { message: "Logged out from all devices" };
  })
  // ---------------------------------------------------------------------------
  // Change Password (protected)
  // ---------------------------------------------------------------------------
  .post(
    "/change-password",
    async ({ body, user, error }) => {
      const result = await authService.changePassword(
        user.id,
        body.currentPassword,
        body.newPassword,
      );

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INCORRECT_PASSWORD":
            return error(401, { message: "Current password is incorrect" });
          case "WEAK_PASSWORD":
            return error(400, {
              message: "New password too weak",
              requirements: err.requirements,
            });
          case "SAME_AS_CURRENT":
            return error(400, {
              message: "New password must be different from current",
            });
        }
      }

      return { message: "Password changed successfully" };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String({ minLength: 8 }),
      }),
    },
  );
```

4. Register the controller in `apps/api/src/index.ts`:

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authController } from "./modules/auth/auth.controller";

const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
    }),
  )
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .group("/api", (app) => app.use(authController))
  .listen(4000);

export type App = typeof app;
```

### Checkpoint

After this phase:

- All auth endpoints are accessible
- Rate limiting blocks excessive requests
- Session cookies are set correctly
- Protected routes require authentication

### Common Pitfalls

- **Forgetting `credentials: true` in CORS**. Without it, cookies aren't sent
  cross-origin.
- **Not checking `NODE_ENV` for secure cookies**. Development over HTTP needs
  secure: false.
- **Leaking information in error messages**. Keep them generic.

---

## Phase 5: OAuth Integration (42 Intra)

### Learning Objective

Implement OAuth 2.0 authentication using Arctic for the 42 Intra provider.

### Understanding the Approach

OAuth allows users to authenticate using their 42 account without sharing their
password. The flow:

1. User clicks "Login with 42"
2. Your app redirects to 42's authorization page
3. User approves the connection
4. 42 redirects back with an authorization code
5. Your server exchanges the code for an access token
6. Your server fetches the user's profile from 42's API
7. You create/update the user and establish a session

Arctic abstracts the complexity of OAuth protocol details.

### Implementation Steps

1. Install Arctic:

```bash
cd apps/api
bun add arctic
```

2. Create OAuth utilities at `apps/api/src/modules/auth/oauth.ts`:

```typescript
import { FortyTwo } from "arctic";

// Initialize the 42 OAuth client
// These values come from your 42 API application settings
export const fortyTwo = new FortyTwo(
  process.env.INTRA_CLIENT_ID!,
  process.env.INTRA_CLIENT_SECRET!,
  process.env.INTRA_REDIRECT_URI!,
);

// Scopes define what information we can access
// "public" gives us basic profile information
export const OAUTH_SCOPES = ["public"];
```

3. Add OAuth methods to the auth service in
   `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { err, ok, ResultAsync } from "neverthrow";
import { generateState, OAuth2RequestError } from "arctic";
import { fortyTwo, OAUTH_SCOPES } from "./oauth";
import type { OAuthError } from "./auth.errors";

// Add to authService object:

export const authService = {
  // ... existing methods ...

  // ---------------------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------------------

  generateOAuthUrl(): { url: string; state: string } {
    // State prevents CSRF attacks
    // Store it in a cookie and verify on callback
    const state = generateState();
    const url = fortyTwo.createAuthorizationURL(state, OAUTH_SCOPES);

    return { url: url.toString(), state };
  },

  handleOAuthCallback(
    code: string,
    storedState: string,
    receivedState: string,
  ): ResultAsync<
    { sessionId: string; user: SafeUser; isNewUser: boolean },
    OAuthError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        // Verify state to prevent CSRF
        if (storedState !== receivedState) {
          return err({ type: "INVALID_STATE" as const });
        }

        // Exchange code for tokens
        let tokens;
        try {
          tokens = await fortyTwo.validateAuthorizationCode(code);
        } catch (e) {
          if (e instanceof OAuth2RequestError) {
            return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
          }
          throw e;
        }

        // Fetch user profile from 42 API
        let profile;
        try {
          const response = await fetch("https://api.intra.42.fr/v2/me", {
            headers: {
              Authorization: `Bearer ${tokens.accessToken()}`,
            },
          });

          if (!response.ok) {
            return err({ type: "PROFILE_FETCH_FAILED" as const });
          }

          profile = await response.json();
        } catch {
          return err({ type: "PROFILE_FETCH_FAILED" as const });
        }

        const intraId = profile.id as number;
        const email = profile.email as string;
        const displayName = profile.login as string;
        const avatarUrl = profile.image?.link as string | undefined;

        // Check if user with this 42 account exists
        let user = await authRepository.findUserByIntraId(intraId);
        let isNewUser = false;

        if (!user) {
          // Check if email is already registered
          const existingByEmail = await authRepository.findUserByEmail(email);

          if (existingByEmail) {
            // Link 42 account to existing user
            user = await authRepository.linkIntraAccount(
              existingByEmail.id,
              intraId,
            );
          } else {
            // Create new user
            user = await authRepository.createUser({
              email,
              displayName,
              intraId,
            });
            isNewUser = true;
          }
        }

        // Update avatar if provided and user doesn't have one
        if (avatarUrl && !user!.avatarUrl) {
          // You could add an updateAvatar method to repository
        }

        // Create session
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
        const session = await authRepository.createSession(user!.id, expiresAt);

        return ok({
          sessionId: session.id,
          user: toSafeUser(user!),
          isNewUser,
        });
      })(),
      () => ({ type: "TOKEN_EXCHANGE_FAILED" as const }),
    ).andThen((result) => result);
  },

  linkOAuthAccount(
    userId: number,
    code: string,
    storedState: string,
    receivedState: string,
  ): ResultAsync<void, OAuthError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Verify state
        if (storedState !== receivedState) {
          return err({ type: "INVALID_STATE" as const });
        }

        // Check if user already has 42 linked
        const user = await authRepository.findUserById(userId);
        if (user?.intraId) {
          return err({ type: "ACCOUNT_ALREADY_LINKED" as const });
        }

        // Exchange code for tokens
        let tokens;
        try {
          tokens = await fortyTwo.validateAuthorizationCode(code);
        } catch {
          return err({ type: "TOKEN_EXCHANGE_FAILED" as const });
        }

        // Fetch 42 profile
        const response = await fetch("https://api.intra.42.fr/v2/me", {
          headers: {
            Authorization: `Bearer ${tokens.accessToken()}`,
          },
        });

        if (!response.ok) {
          return err({ type: "PROFILE_FETCH_FAILED" as const });
        }

        const profile = await response.json();
        const intraId = profile.id as number;

        // Check if this 42 account is already linked to another user
        const existingLink = await authRepository.findUserByIntraId(intraId);
        if (existingLink) {
          return err({ type: "ACCOUNT_ALREADY_LINKED" as const });
        }

        // Link the account
        await authRepository.linkIntraAccount(userId, intraId);

        return ok(undefined);
      })(),
      () => ({ type: "TOKEN_EXCHANGE_FAILED" as const }),
    ).andThen((result) => result);
  },
};
```

4. Add OAuth routes to the controller:

```typescript
// Add to authController:

  // ---------------------------------------------------------------------------
  // OAuth: Initiate 42 Login
  // ---------------------------------------------------------------------------
  .get("/42", ({ cookie, set }) => {
    const { url, state } = authService.generateOAuthUrl();

    // Store state in cookie for CSRF protection
    cookie.oauth_state.set({
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });

    // Redirect to 42
    set.redirect = url;
    return;
  })

  // ---------------------------------------------------------------------------
  // OAuth: Handle 42 Callback
  // ---------------------------------------------------------------------------
  .get(
    "/42/callback",
    async ({ query, cookie, set, error }) => {
      const code = query.code;
      const state = query.state;
      const storedState = cookie.oauth_state?.value;

      // Clear the state cookie
      cookie.oauth_state.remove();

      if (!code || !state || !storedState) {
        return error(400, { message: "Invalid OAuth callback" });
      }

      const result = await authService.handleOAuthCallback(
        code,
        storedState,
        state
      );

      if (result.isErr()) {
        const err = result.error;
        // Redirect to frontend with error
        set.redirect = `${process.env.FRONTEND_URL}/auth/error?code=${err.type}`;
        return;
      }

      const { sessionId, isNewUser } = result.value;

      // Set session cookie
      cookie.session.set({
        value: sessionId,
        ...SESSION_COOKIE_OPTIONS,
      });

      // Redirect to frontend
      const redirectUrl = isNewUser
        ? `${process.env.FRONTEND_URL}/welcome`
        : `${process.env.FRONTEND_URL}/`;

      set.redirect = redirectUrl;
      return;
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // OAuth: Link 42 Account (protected)
  // ---------------------------------------------------------------------------
  .post(
    "/42/link",
    async ({ query, cookie, user, error }) => {
      const code = query.code;
      const state = query.state;
      const storedState = cookie.oauth_state?.value;

      cookie.oauth_state.remove();

      if (!code || !state || !storedState) {
        return error(400, { message: "Invalid OAuth callback" });
      }

      const result = await authService.linkOAuthAccount(
        user.id,
        code,
        storedState,
        state
      );

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INVALID_STATE":
            return error(400, { message: "Invalid OAuth state" });
          case "ACCOUNT_ALREADY_LINKED":
            return error(409, { message: "42 account already linked" });
          default:
            return error(500, { message: "OAuth linking failed" });
        }
      }

      return { message: "42 account linked successfully" };
    },
    {
      query: t.Object({
        code: t.String(),
        state: t.String(),
      }),
    }
  )
```

### Checkpoint

After this phase:

- `GET /api/auth/42` redirects to 42's OAuth page
- Callback creates/links user and establishes session
- Existing users can link their 42 account

### Common Pitfalls

- **Not verifying the state parameter**. This opens you to CSRF attacks.
- **Using the wrong redirect URI**. It must exactly match what's registered in
  42's API settings.
- **Exposing tokens in logs**. Never log access tokens.

---

## Phase 6: TOTP Two-Factor Authentication

### Learning Objective

Add time-based one-time password (TOTP) support using Oslo for enhanced account
security.

### Understanding the Approach

TOTP generates codes that change every 30 seconds. Both your server and the
user's authenticator app share a secret. They independently calculate the same
code based on the current time.

Flow:

1. User enables 2FA → Server generates secret → Show QR code
2. User scans QR → Authenticator stores secret
3. User enters code from app → Server verifies
4. On login, require TOTP code after password

### Implementation Steps

1. Install Oslo:

```bash
cd apps/api
bun add oslo @oslojs/encoding @oslojs/otp
```

2. Create TOTP utilities at `apps/api/src/modules/auth/totp.ts`:

```typescript
import { encodeBase32 } from "@oslojs/encoding";
import { createTOTPKeyURI, verifyTOTP } from "@oslojs/otp";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// App name shown in authenticator
const TOTP_ISSUER = "ft_transcendence";

// Encryption for storing secrets at rest
const ENCRYPTION_KEY = Buffer.from(
  process.env.TOTP_ENCRYPTION_KEY ?? randomBytes(32).toString("hex"),
  "hex",
);
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Generate a new TOTP secret.
 * Returns the raw secret (for storage) and the QR code URL.
 */
export function generateTotpSecret(userEmail: string): {
  secret: Uint8Array;
  keyUri: string;
} {
  // 20 bytes is standard for TOTP (160 bits)
  const secret = randomBytes(20);

  // Generate the otpauth:// URI for QR codes
  const keyUri = createTOTPKeyURI(TOTP_ISSUER, userEmail, secret);

  return { secret, keyUri };
}

/**
 * Verify a TOTP code against a secret.
 * Allows 1 period of clock drift in either direction.
 */
export function verifyTotpCode(secret: Uint8Array, code: string): boolean {
  return verifyTOTP(secret, 30, 6, code);
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

  // Format: iv:authTag:encrypted (all base64)
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
```

3. Add 2FA methods to the auth service:

```typescript
import {
  generateTotpSecret,
  verifyTotpCode,
  encryptSecret,
  decryptSecret,
  secretToBase32,
} from "./totp";
import type { TotpError } from "./auth.errors";

// Add to authService:

  // ---------------------------------------------------------------------------
  // Two-Factor Authentication
  // ---------------------------------------------------------------------------

  enableTotp(
    userId: number
  ): ResultAsync<{ qrCodeUrl: string; secret: string }, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user) {
          return err({ type: "NOT_ENABLED" as const });
        }

        if (user.twoFactorEnabled) {
          return err({ type: "ALREADY_ENABLED" as const });
        }

        // Generate new TOTP secret
        const { secret, keyUri } = generateTotpSecret(user.email);

        // Encrypt and store (but don't enable yet)
        const encryptedSecret = encryptSecret(secret);
        await authRepository.updateTotpSecret(userId, encryptedSecret, false);

        return ok({
          qrCodeUrl: keyUri,
          secret: secretToBase32(secret), // For manual entry
        });
      })(),
      () => ({ type: "NOT_ENABLED" as const })
    ).andThen((result) => result);
  },

  confirmTotp(userId: number, code: string): ResultAsync<void, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        if (user.twoFactorEnabled) {
          return err({ type: "ALREADY_ENABLED" as const });
        }

        // Decrypt and verify the code
        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        // Enable 2FA
        await authRepository.updateTotpSecret(userId, user.totpSecret, true);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  },

  verifyTotp(userId: number, code: string): ResultAsync<void, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.twoFactorEnabled || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  },

  disableTotp(userId: number, code: string): ResultAsync<void, TotpError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await authRepository.findUserById(userId);

        if (!user || !user.twoFactorEnabled || !user.totpSecret) {
          return err({ type: "NOT_ENABLED" as const });
        }

        // Verify code before disabling
        const secret = decryptSecret(user.totpSecret);
        const valid = verifyTotpCode(secret, code);

        if (!valid) {
          return err({ type: "INVALID_CODE" as const });
        }

        // Disable 2FA
        await authRepository.updateTotpSecret(userId, null, false);

        return ok(undefined);
      })(),
      () => ({ type: "INVALID_CODE" as const })
    ).andThen((result) => result);
  },
```

4. Add 2FA routes to the controller:

```typescript
// Add to authController (after authGuard):

  // ---------------------------------------------------------------------------
  // 2FA: Enable (Step 1 - Generate)
  // ---------------------------------------------------------------------------
  .post("/2fa/enable", async ({ user, error }) => {
    const result = await authService.enableTotp(user.id);

    if (result.isErr()) {
      const err = result.error;
      if (err.type === "ALREADY_ENABLED") {
        return error(409, { message: "2FA is already enabled" });
      }
      return error(400, { message: "Failed to enable 2FA" });
    }

    return {
      message: "Scan the QR code with your authenticator app",
      qrCodeUrl: result.value.qrCodeUrl,
      secret: result.value.secret, // For manual entry
    };
  })

  // ---------------------------------------------------------------------------
  // 2FA: Confirm (Step 2 - Verify and Activate)
  // ---------------------------------------------------------------------------
  .post(
    "/2fa/confirm",
    async ({ body, user, error }) => {
      const result = await authService.confirmTotp(user.id, body.code);

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INVALID_CODE":
            return error(400, { message: "Invalid verification code" });
          case "ALREADY_ENABLED":
            return error(409, { message: "2FA is already enabled" });
          default:
            return error(400, { message: "Failed to confirm 2FA" });
        }
      }

      return { message: "2FA enabled successfully" };
    },
    {
      body: t.Object({
        code: t.String({ pattern: "^[0-9]{6}$" }), // 6-digit code
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // 2FA: Verify (During Login)
  // ---------------------------------------------------------------------------
  .post(
    "/2fa/verify",
    async ({ body, cookie, error }) => {
      const sessionId = cookie.session?.value;

      if (!sessionId) {
        return error(401, { message: "No pending 2FA session" });
      }

      // Get user from partial session
      const sessionResult = await authService.validateSession(sessionId);
      if (sessionResult.isErr()) {
        return error(401, { message: "Invalid session" });
      }

      const user = sessionResult.value;

      const result = await authService.verifyTotp(user.id, body.code);

      if (result.isErr()) {
        return error(400, { message: "Invalid 2FA code" });
      }

      return {
        message: "2FA verified",
        user,
      };
    },
    {
      body: t.Object({
        code: t.String({ pattern: "^[0-9]{6}$" }),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // 2FA: Disable
  // ---------------------------------------------------------------------------
  .post(
    "/2fa/disable",
    async ({ body, user, error }) => {
      const result = await authService.disableTotp(user.id, body.code);

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INVALID_CODE":
            return error(400, { message: "Invalid verification code" });
          case "NOT_ENABLED":
            return error(400, { message: "2FA is not enabled" });
        }
      }

      return { message: "2FA disabled successfully" };
    },
    {
      body: t.Object({
        code: t.String({ pattern: "^[0-9]{6}$" }),
      }),
    }
  )
```

### Checkpoint

After this phase:

- Users can enable 2FA and see QR code
- Authenticator apps generate valid codes
- Login requires 2FA code when enabled
- Users can disable 2FA with verification

### Common Pitfalls

- **Storing TOTP secrets unencrypted**. Always encrypt at rest.
- **Not allowing clock drift**. Users' phones may be slightly out of sync.
- **Enabling 2FA before verification**. Always require a valid code to confirm
  setup.

---

## Testing Your Implementation

### Manual Testing Checklist

1. **Registration Flow**
   - [ ] Can register with valid email/password
   - [ ] Registration fails for duplicate email
   - [ ] Weak passwords are rejected
   - [ ] Verification email token is generated

2. **Login Flow**
   - [ ] Can log in with correct credentials
   - [ ] Wrong password returns generic error
   - [ ] Account locks after 10 failed attempts
   - [ ] Session cookie is set correctly

3. **OAuth Flow**
   - [ ] Redirects to 42's auth page
   - [ ] Callback creates new user
   - [ ] Existing users can link 42 account
   - [ ] Session is established after OAuth

4. **2FA Flow**
   - [ ] Can enable 2FA and see QR code
   - [ ] Authenticator app codes work
   - [ ] Login prompts for 2FA when enabled
   - [ ] Can disable 2FA with valid code

5. **Security**
   - [ ] Rate limiting blocks excessive requests
   - [ ] Cookies are HttpOnly and Secure
   - [ ] Password reset doesn't reveal email existence

---

## Troubleshooting

### "Invalid credentials" even with correct password

**Possible causes:**

- Email not verified (check `emailVerified` in database)
- Account locked (check `lockedUntil`)
- Password hash corrupted

**Solution:** Check the specific error returned by the service.

### "CORS error" on login

**Cause:** Credentials not being sent.

**Solution:** Ensure both CORS config and fetch have `credentials`:

```typescript
// Backend
cors({ credentials: true });
// Frontend
fetch(url, { credentials: "include" });
```

### TOTP codes not working

**Possible causes:**

- Clock out of sync (check server time)
- Secret decryption failing (check encryption key)
- Wrong algorithm (we use SHA-1, 6 digits, 30 seconds)

**Solution:** Verify the server time: `date` should match actual time.

### "Session not found" after login

**Cause:** Cookie not being set or sent.

**Solution:**

- Check browser dev tools → Application → Cookies
- Ensure `sameSite: "lax"` not `strict` for OAuth callbacks
- Check domain matches between frontend/backend

---

## Going Deeper

### Official Documentation

- [Argon2 Paper](https://www.password-hashing.net/argon2-specs.pdf)
- [Oslo Authentication Library](https://oslojs.dev/)
- [Arctic OAuth](https://arcticjs.dev/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Security Topics to Research

- CSRF protection mechanisms
- XSS prevention strategies
- Secure cookie attributes in depth
- OAuth 2.0 security best practices
- Time-based attacks and constant-time comparison

### Suggested Improvements

- Add recovery codes for 2FA backup
- Implement "remember this device" for 2FA
- Add login history and suspicious activity alerts
- Implement WebAuthn for passwordless auth
- Add security key (FIDO2) support

---

## Self-Assessment Questions

1. **Conceptual**: Why do we use database sessions instead of JWTs? What's the
   trade-off?

2. **Security**: A login endpoint returns "user not found" for invalid emails
   and "wrong password" for invalid passwords. What vulnerability does this
   create?

3. **Application**: If you needed to add "security questions" as an account
   recovery method, which layers would you modify?

4. **Debugging**: A user reports their TOTP codes never work. What would you
   check?

5. **Architecture**: Why must the service layer be framework-agnostic? What
   benefits does this provide?
