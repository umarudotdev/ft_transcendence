**Role:** Act as a senior backend developer implementing authentication for
ft_transcendence—a real-time Pong platform requiring email/password login, 42
OAuth, and TOTP 2FA.

**Context:** This project uses database sessions (not JWT) for immediate
revocation capability. Authentication supports **email/password** (primary) with
**Argon2id** hashing, **Arctic** for 42 OAuth (optional linking), and **Oslo**
for TOTP. Sessions are stored in PostgreSQL with HttpOnly cookies. The goal is
**Milestone 2: Auth**—users can register/login and access protected routes.

**Task:** Implement the complete auth module following vertical slice
architecture:

---

### 1. Database Schema (`apps/api/src/db/schema.ts`)

Add the following tables:

**`users` table:**

- `id` (serial primary key)
- `email` (text, unique, not null)
- `passwordHash` (text, nullable) — Argon2id hash, null if OAuth-only user
- `emailVerified` (boolean, default false)
- `displayName` (text)
- `avatarUrl` (nullable text)
- `intraId` (integer, unique, nullable) — 42 Intra user ID for OAuth linking
- `totpSecret` (nullable text) — encrypted TOTP secret for 2FA
- `twoFactorEnabled` (boolean, default false)
- `createdAt` (timestamp with timezone)
- `updatedAt` (timestamp with timezone)

**`password_reset_tokens` table:**

- `id` (text primary key) — secure random token
- `userId` (integer, references users.id, cascade delete)
- `expiresAt` (timestamp with timezone) — 1 hour expiry
- `createdAt` (timestamp with timezone)

**`email_verification_tokens` table:**

- `id` (text primary key) — secure random token
- `userId` (integer, references users.id, cascade delete)
- `expiresAt` (timestamp with timezone) — 24 hour expiry
- `createdAt` (timestamp with timezone)

**`sessions` table:**

- `id` (text primary key) — secure random session ID
- `userId` (integer, references users.id, cascade delete)
- `expiresAt` (timestamp with timezone)
- `createdAt` (timestamp with timezone)

Generate and apply the migration after schema changes.

---

### 2. Auth Repository (`apps/api/src/modules/auth/auth.repository.ts`)

Implement database operations:

**User Operations:**

- `findUserById(id: number)`
- `findUserByEmail(email: string)`
- `findUserByIntraId(intraId: number)`
- `createUser(data: { email, passwordHash?, displayName, intraId? })`
- `updatePassword(userId: number, passwordHash: string)`
- `updateEmailVerified(userId: number, verified: boolean)`
- `linkIntraAccount(userId: number, intraId: number)`
- `updateUserTotp(userId: number, secret: string | null, enabled: boolean)`

**Session Operations:**

- `createSession(userId: number, expiresAt: Date): Promise<{ id: string }>`
- `findSessionById(sessionId: string)`
- `deleteSession(sessionId: string)`
- `deleteAllUserSessions(userId: number)` — for password change
- `deleteExpiredSessions()`

**Token Operations:**

- `createPasswordResetToken(userId: number, expiresAt: Date): Promise<{ id: string }>`
- `findPasswordResetToken(tokenId: string)`
- `deletePasswordResetToken(tokenId: string)`
- `createEmailVerificationToken(userId: number, expiresAt: Date): Promise<{ id: string }>`
- `findEmailVerificationToken(tokenId: string)`
- `deleteEmailVerificationToken(tokenId: string)`

---

### 3. Auth Service (`apps/api/src/modules/auth/auth.service.ts`)

Implement business logic using **neverthrow** for type-safe error handling (no
Elysia imports).

Use **@node-rs/argon2** for password hashing with these settings:

```typescript
const hashOptions = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
```

All service methods should return `Result<T, E>` or `ResultAsync<T, E>` instead
of throwing:

**Email/Password Auth:**

- `register(data: { email, password, displayName }): ResultAsync<{ user: User }, RegisterError>`
- `login(email: string, password: string): ResultAsync<{ sessionId: string; user: User; requires2fa: boolean }, LoginError>`
- `verifyEmail(token: string): ResultAsync<void, TokenError>`
- `resendVerificationEmail(userId: number): ResultAsync<void, never>`
- `requestPasswordReset(email: string): ResultAsync<void, never>` — always
  succeeds (no email enumeration)
- `resetPassword(token: string, newPassword: string): ResultAsync<void, TokenError | PasswordError>`
- `changePassword(userId: number, currentPassword: string, newPassword: string): ResultAsync<void, PasswordError>`

**OAuth (42 Intra):**

- `generateOAuthUrl(): Result<{ url: string; state: string }, never>`
- `handleOAuthCallback(code: string, state: string): ResultAsync<{ sessionId: string; user: User }, OAuthError>`
- `linkOAuthAccount(userId: number, code: string, state: string): ResultAsync<void, OAuthError>`

**Session Management:**

- `validateSession(sessionId: string): ResultAsync<User, SessionError>`
- `logout(sessionId: string): ResultAsync<void, never>`
- `logoutAllDevices(userId: number): ResultAsync<void, never>`

**2FA (TOTP):**

- `enableTotp(userId: number): ResultAsync<{ qrCodeUrl: string; secret: string }, TotpError>`
- `verifyTotp(userId: number, code: string): ResultAsync<void, TotpError>`
- `disableTotp(userId: number, code: string): ResultAsync<void, TotpError>`

**Error Types:**

```typescript
type RegisterError =
  | { type: "EMAIL_EXISTS" }
  | { type: "WEAK_PASSWORD"; requirements: string[] };

type LoginError =
  | { type: "INVALID_CREDENTIALS" } // Generic to prevent enumeration
  | { type: "EMAIL_NOT_VERIFIED" }
  | { type: "ACCOUNT_LOCKED"; unlockAt: Date };

type PasswordError =
  | { type: "INCORRECT_PASSWORD" }
  | { type: "WEAK_PASSWORD"; requirements: string[] }
  | { type: "SAME_AS_CURRENT" };

type TokenError = { type: "INVALID_TOKEN" } | { type: "EXPIRED_TOKEN" };

type OAuthError =
  | { type: "INVALID_STATE" }
  | { type: "TOKEN_EXCHANGE_FAILED" }
  | { type: "PROFILE_FETCH_FAILED" }
  | { type: "ACCOUNT_ALREADY_LINKED" };

type SessionError = { type: "NOT_FOUND" } | { type: "EXPIRED" };
type TotpError =
  | { type: "INVALID_CODE" }
  | { type: "ALREADY_ENABLED" }
  | { type: "NOT_ENABLED" };
```

**Password Requirements:**

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Not in common password list (check against top 10k)

---

### 4. Auth Controller (`apps/api/src/modules/auth/auth.controller.ts`)

Implement HTTP endpoints with TypeBox validation:

**Email/Password Auth:**

| Method | Path                        | Description                                   |
| ------ | --------------------------- | --------------------------------------------- |
| `POST` | `/auth/register`            | Create account (email, password, displayName) |
| `POST` | `/auth/login`               | Login with email/password, set session cookie |
| `POST` | `/auth/verify-email`        | Verify email with token from email link       |
| `POST` | `/auth/resend-verification` | Resend verification email (protected)         |
| `POST` | `/auth/forgot-password`     | Request password reset email                  |
| `POST` | `/auth/reset-password`      | Reset password with token                     |
| `POST` | `/auth/change-password`     | Change password (protected, requires current) |

**OAuth (42 Intra):**

| Method | Path                | Description                                           |
| ------ | ------------------- | ----------------------------------------------------- |
| `GET`  | `/auth/42`          | Redirect to 42 OAuth (generate URL, set state cookie) |
| `GET`  | `/auth/42/callback` | Handle OAuth callback, set session cookie, redirect   |
| `POST` | `/auth/42/link`     | Link 42 account to existing user (protected)          |

**Session Management:**

| Method | Path               | Description                                  |
| ------ | ------------------ | -------------------------------------------- |
| `GET`  | `/auth/me`         | Return current user from session (protected) |
| `POST` | `/auth/logout`     | Destroy current session, clear cookie        |
| `POST` | `/auth/logout-all` | Destroy all user sessions (protected)        |

**2FA (TOTP):**

| Method | Path                | Description                      |
| ------ | ------------------- | -------------------------------- |
| `POST` | `/auth/2fa/enable`  | Generate TOTP secret and QR code |
| `POST` | `/auth/2fa/verify`  | Verify code and activate 2FA     |
| `POST` | `/auth/2fa/disable` | Verify code and deactivate 2FA   |

**Rate Limiting (per IP):**

- `/auth/login`: 5 attempts per 15 minutes
- `/auth/register`: 3 attempts per hour
- `/auth/forgot-password`: 3 attempts per hour
- `/auth/reset-password`: 5 attempts per hour
- All other auth endpoints: 100 requests per minute

---

### 5. Auth Guard (`apps/api/src/common/guards/auth.guard.ts`)

Create an Elysia plugin/derive that:

- Reads session ID from HttpOnly cookie
- Validates session via `authService.validateSession()`
- Attaches `user` to context if valid
- Returns 401 if session is missing or expired

---

### 6. Frontend Integration (`apps/web`)

Use **TanStack Query** (`@tanstack/svelte-query`) for all API data fetching:

**Setup:**

- Configure QueryClient in `src/lib/query.ts`
- Wrap app with `QueryClientProvider` in `+layout.svelte`

**Auth Queries/Mutations:**

```typescript
// src/lib/queries/auth.ts
export const authKeys = {
  me: ["auth", "me"] as const,
  session: ["auth", "session"] as const,
};

export function createMeQuery() {
  return createQuery({
    queryKey: authKeys.me,
    queryFn: () => api.auth.me.get(),
  });
}

// Email/Password
export function createRegisterMutation() { ... }
export function createLoginMutation() { ... }
export function createForgotPasswordMutation() { ... }
export function createResetPasswordMutation() { ... }
export function createChangePasswordMutation() { ... }

// Session
export function createLogoutMutation() {
  return createMutation({
    mutationFn: () => api.auth.logout.post(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}
export function createLogoutAllMutation() { ... }

// 2FA
export function createEnable2faMutation() { ... }
export function createVerify2faMutation() { ... }
export function createDisable2faMutation() { ... }
```

**Pages:**

- `/auth/register` — Registration form (email, password, confirm password,
  display name)
- `/auth/login` — Login form with email/password + "Login with 42" OAuth button
- `/auth/verify-email/[token]` — Email verification landing page
- `/auth/forgot-password` — Request password reset form
- `/auth/reset-password/[token]` — Set new password form
- `/settings/security` — Change password, link 42 account, manage 2FA
- `/settings/2fa` — 2FA setup page with QR code display and code input
- Use `createMeQuery()` for auth state instead of manual stores
- Protect routes using SvelteKit `+layout.server.ts` load function

**Form Validation (client-side):**

- Email: valid format, required
- Password: show strength meter, real-time requirement checklist
- Confirm password: must match
- Display name: 3-30 characters

**Query Patterns:**

- Use `createQuery` for data fetching (auth/me, user profiles)
- Use `createMutation` for actions (logout, enable 2FA, verify code)
- Invalidate `authKeys.me` after auth state changes
- Handle loading/error states with query status

---

**Constraints:**

- Database sessions only (no JWT)
- HttpOnly, Secure, SameSite=Lax cookies
- CSRF protection via origin header validation
- Service layer must be framework-agnostic (no Elysia imports)
- All secrets stored encrypted or use environment variables
- **Argon2id:** Use @node-rs/argon2 for password hashing (OWASP recommended
  settings)
- **neverthrow:** All service methods return `Result`/`ResultAsync`, no throwing
- **TanStack Query:** All frontend API calls use queries/mutations, no raw fetch
  in components
- **No email enumeration:** Login and forgot-password must not reveal if email
  exists
- **Timing-safe comparison:** Use constant-time comparison for tokens and
  passwords

**Security Requirements:**

- Passwords hashed with Argon2id (memory: 19 MiB, iterations: 2, parallelism: 1)
- Password reset tokens: 32 bytes, URL-safe base64, 1 hour expiry
- Email verification tokens: 32 bytes, URL-safe base64, 24 hour expiry
- Session IDs: 32 bytes, cryptographically random
- Rate limiting with exponential backoff on failed logins
- Account lockout after 10 failed attempts (15 minute cooldown)

**Environment Variables Required:**

```
# Email/Password
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@ft-transcendence.local

# OAuth (optional)
INTRA_CLIENT_ID=
INTRA_CLIENT_SECRET=
INTRA_REDIRECT_URI=https://localhost/api/auth/42/callback

# Security
SESSION_SECRET=           # For cookie signing (32+ bytes)
TOTP_ENCRYPTION_KEY=      # For encrypting TOTP secrets at rest (32 bytes)
```

**Output Format:** For each component, provide:

1. Complete file path
2. Full implementation code
3. Any terminal commands needed

**Verification:**

- [ ] Registration creates user with hashed password
- [ ] Login with correct credentials creates session
- [ ] Login with wrong password returns generic "invalid credentials" error
- [ ] Login rate limiting kicks in after 5 failed attempts
- [ ] Email verification token validates and marks email as verified
- [ ] Password reset flow sends email and allows password change
- [ ] Password change invalidates all other sessions
- [ ] Session cookie is HttpOnly and Secure
- [ ] `GET /api/auth/me` returns user when authenticated, 401 otherwise
- [ ] OAuth login/linking works alongside email/password
- [ ] 2FA enrollment generates valid QR code scannable by authenticator apps
- [ ] TOTP codes validate correctly with 30-second window
- [ ] Logout immediately invalidates session (no delayed expiration)
- [ ] Protected frontend routes redirect to login when unauthenticated
