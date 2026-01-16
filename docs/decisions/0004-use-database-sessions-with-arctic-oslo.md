# Use Database Sessions with Arctic and Oslo

## Status

Accepted

## Context and Problem Statement

The ft_transcendence subject emphasizes User Management (Major Module - 2pts)
and Security. Users must log in via 42 Intra OAuth, and Two-Factor
Authentication is required for a Minor Module. During evaluation, we must
explain exactly how sessions are stored, cookies are signed, and passwords are
hashed.

How should we implement authentication to satisfy security requirements while
maintaining full transparency of the implementation for the evaluation defense?

## Decision Drivers

- Must support 42 Intra OAuth integration
- Must implement TOTP-based 2FA for module compliance
- Must be able to explain all authentication logic during defense (no black box
  libraries)
- Need ability to revoke sessions immediately (logout, ban, password change)
- Security must follow OWASP best practices

## Considered Options

- Stateless JWT tokens
- Auth.js / BetterAuth full-stack solution
- Database sessions with Arctic + Oslo

## Decision Outcome

Chosen option: "Database sessions with Arctic + Oslo", because it provides
immediate session revocation, full transparency of authentication logic for
defense, and leverages focused libraries for OAuth and TOTP without imposing
opinionated schemas.

### Consequences

#### Positive

- Defense Ready: We control the database schema explicitly; can show evaluator
  exact SQL queries for session validation
- Security: HttpOnly cookies prevent XSS token theft; CSRF protection via Elysia
  origin checks
- Flexibility: Can add custom fields to sessions (e.g., is_admin) without
  fighting library abstractions

#### Negative

- Boilerplate: Must write Drizzle schema and cookie handling logic manually
- Responsibility: Must implement session cleanup (expired session deletion) via
  cron job or periodic check

### Confirmation

The decision will be confirmed by:

- Successful 42 OAuth flow completing user creation and session establishment
- TOTP enrollment and verification working with standard authenticator apps
- Session revocation immediately invalidating user access
- Code review verifying no authentication black boxes

## Pros and Cons of the Options

### Stateless JWT Tokens

- Good, because no database lookups required for validation
- Good, because horizontally scalable without shared session store
- Bad, because cannot immediately revoke tokens (must wait for expiration)
- Bad, because token size increases with claims
- Bad, because requires refresh token rotation complexity

### Auth.js / BetterAuth Full-Stack Solution

- Good, because minimal code required for common auth flows
- Good, because handles edge cases automatically
- Bad, because magic abstractions are difficult to explain during defense
- Bad, because opinionated database schema may conflict with our design
- Bad, because debugging issues requires understanding library internals

### Database Sessions with Arctic + Oslo

- Good, because full control over session and user table schemas
- Good, because Arctic provides clean OAuth wrapper without schema opinions
- Good, because Oslo TOTP is focused and auditable
- Good, because immediate session revocation via database delete
- Good, because all logic visible in src/modules/auth for defense
- Bad, because more initial implementation effort
- Bad, because responsible for session cleanup maintenance

## More Information

### Session Architecture

- **Storage**: PostgreSQL `session` table with `session_id`, `user_id`,
  `expires_at`
- **Transport**: Session ID in Secure, HttpOnly, SameSite=Lax cookie
- **Validation**: Database lookup on each authenticated request

### OAuth Flow (Arctic)

1. Redirect user to 42 Intra authorization URL
2. Handle callback with authorization code
3. Exchange code for access token
4. Fetch user profile from 42 API
5. Create or update user in database
6. Create session and set cookie

### 2FA Flow (Oslo TOTP)

1. Generate secret and store encrypted in user record
2. Generate `otpauth://` URL for QR code display
3. User scans with authenticator app
4. Verify submitted code using HMAC-SHA1
5. Mark 2FA as enabled on successful verification

### Compliance Check

- [x] User Management (Major - 2pts): Full control over User/Session tables
- [x] OAuth (42): Implemented via Arctic
- [x] 2FA (Minor - 1pt): Implemented via Oslo TOTP
- [x] No "Black Box": All logic visible and explainable
