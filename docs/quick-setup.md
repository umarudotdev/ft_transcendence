# Quick Setup Guide

## Full Stack (Recommended)

```bash
bun install                    # Install dependencies
docker compose up --build      # Start db, api, web
```

Access at `http://localhost:5173`

---

## Development Mode (DB in Docker, code locally)

```bash
docker compose up db -d        # Start only database
cd apps/api && bun run migrate # Apply migrations
bun run dev                    # Start api + web with hot reload
```

---

## Database

### Apply Migrations
```bash
cd apps/api && bun run migrate
```

### Seed Test Data
```bash
cd apps/api && bun run src/db/seed.ts
```

Creates 51 users, matches, friendships, achievements, etc.

**Test credentials:**
- `admin.user@example.com` / `Password123!`
- `moderator.user@example.com` / `Password123!`
- `alice.johnson@example.com` / `Password123!`

### Create Quick Test User
```bash
cd apps/api
bun -e "
import { hashPassword } from './src/modules/auth/password';
import { db } from './src/db';
import { users } from './src/db/schema';

await db.insert(users).values({
  username: 'a',
  displayName: 'A',
  email: 'a@a.com',
  passwordHash: await hashPassword('123'),
  emailVerified: true,
});
console.log('Created: a@a.com / 123');
process.exit(0);
"
```

### Access Database
```bash
# psql
docker compose exec db psql -U postgres -d ft_transcendence

# Drizzle Studio (GUI)
cd apps/api && bunx drizzle-kit studio
```

---

## Troubleshooting

### "Too many requests" on login/register

Rate limits are strict (3 per hour for register, 5 per 15min for login).

**Fix:** Edit `apps/api/src/modules/auth/auth.controller.ts`:
- Line 48 (register): change `max: 3` to `max: 100`
- Line 74 (login): change `max: 5` to `max: 100`

### Lockfile error in Docker build

```
error: lockfile had changes, but lockfile is frozen
```

**Fix:** Update lockfile locally first:
```bash
bun install
docker compose up --build
```

### Workspace package not found

```
error: Workspace dependency "@ft/supercluster" not found
```

**Fix:** Ensure Dockerfiles include the package. In `apps/web/Dockerfile` and `apps/api/Dockerfile`, add:
```dockerfile
COPY packages/supercluster/package.json ./packages/supercluster/
```

### Port 5432 already in use

```bash
docker compose down
docker ps -a | grep postgres     # Find conflicting containers
docker stop <container_id>
docker compose up db -d
```

### Migrations run but no tables

Database port not exposed. Force recreate:
```bash
docker compose down
docker compose up db -d --force-recreate
cd apps/api && bun run migrate
```

### Reset everything

```bash
docker compose down -v           # -v removes volumes (deletes data)
docker compose up --build
cd apps/api && bun run migrate
cd apps/api && bun run src/db/seed.ts
```
