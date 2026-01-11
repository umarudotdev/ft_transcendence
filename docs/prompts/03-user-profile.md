**Role:** Act as a senior frontend developer with UX expertise, designing the
user profile system for ft_transcendence—a real-time multiplayer gaming platform
for 42 students.

**Context:** This project uses SvelteKit with Tailwind CSS and Shadcn-Svelte
components. User profiles are central to the **User Management module (2 pts)**
and **Game Statistics module (1 pt)**. The profile must display player identity,
match history, and social connections while supporting avatar uploads and
display name editing. The design should be **game-agnostic**—reusable regardless
of the specific game implemented.

**Task:** Design and implement the complete user profile system:

---

### 1. Database Schema Updates (`apps/api/src/db/schema.ts`)

Ensure the `users` table includes:

- `displayName` (text, editable by user)
- `avatarUrl` (nullable text, max 2MB image)
- `createdAt` (timestamp)

Add a `matches` table for game history (game-agnostic):

- `id` (serial primary key)
- `player1Id`, `player2Id` (references users.id, player2 nullable for AI)
- `player1Score`, `player2Score` (integer)
- `winnerId` (references users.id, nullable for draws)
- `gameType` (text) — extensible for future games
- `isAiGame` (boolean, default false)
- `metadata` (jsonb, nullable) — game-specific data
- `duration` (integer, seconds)
- `createdAt` (timestamp)

Add a `friends` table:

- `id` (serial primary key)
- `userId`, `friendId` (references users.id)
- `status` (enum: 'pending', 'accepted', 'blocked')
- `createdAt` (timestamp)

---

### 2. Users Module (Backend)

**Repository** (`apps/api/src/modules/users/users.repository.ts`):

- `findById(id: number)` — fetch user with stats
- `updateProfile(id: number, data: { displayName?, avatarUrl? })`
- `getMatchHistory(userId: number, options: { limit?, offset?, gameType? })`
- `getStats(userId: number, gameType?: string)` — wins, losses, win rate, games
  played
- `getFriends(userId: number)` — list accepted friends
- `getPendingRequests(userId: number)`

**Service** (`apps/api/src/modules/users/users.service.ts`):

- `getProfile(id: number)` — return user + computed stats
- `updateProfile(userId: number, data)` — validate display name (3-20 chars,
  alphanumeric)
- `uploadAvatar(userId: number, file: File)` — validate type (JPEG/PNG/WebP),
  resize to 256x256, upload to storage
- `getMatchHistory(userId: number, pagination, filters?)` — return paginated
  matches
- `calculateStats(userId: number, gameType?: string)` — aggregate
  wins/losses/win rate

**Controller** (`apps/api/src/modules/users/users.controller.ts`):

| Method  | Path                 | Description                           |
| ------- | -------------------- | ------------------------------------- |
| `GET`   | `/users/me`          | Current user's profile (protected)    |
| `PATCH` | `/users/me`          | Update display name                   |
| `POST`  | `/users/me/avatar`   | Upload avatar image (multipart)       |
| `GET`   | `/users/:id`         | Public profile by ID                  |
| `GET`   | `/users/:id/stats`   | Game statistics (optional ?gameType)  |
| `GET`   | `/users/:id/matches` | Match history (paginated, filterable) |

---

### 3. Frontend Pages (`apps/web/src/routes`)

**Own Profile Page** (`/profile/+page.svelte`):

- Display avatar with edit overlay (click to upload)
- Editable display name (inline edit or modal)
- Stats dashboard: Total games, Wins, Losses, Win Rate %
- Recent matches list (last 10)
- Friends list with online status indicators
- Settings link (2FA, logout)

**Public Profile Page** (`/users/[id]/+page.svelte`):

- Read-only view of another user's profile
- Same stats and match history
- Friend actions: Add Friend / Pending / Unfriend / Block
- "Challenge to Game" button (if friends)

**Match History Component** (`$lib/components/MatchHistory.svelte`):

- Table/list showing: Opponent, Score, Result (Win/Loss/Draw), Duration, Date
- Pagination controls (10 per page)
- Filter: All / Wins / Losses / vs AI / by Game Type

**Stats Card Component** (`$lib/components/StatsCard.svelte`):

- Visual stats: Games played, Win rate (progress bar), Win/Loss ratio
- Optional breakdown by game type (if multiple games exist)
- Optional: Win streak, average game duration

---

### 4. Avatar Upload Flow

1. User clicks avatar → file picker opens (accept: image/jpeg, image/png,
   image/webp)
2. Client-side validation: max 2MB, image dimensions
3. Preview before upload (optional crop to square)
4. `POST /users/me/avatar` with `multipart/form-data`
5. Server resizes to 256x256, stores in `/uploads/avatars/{userId}.webp`
6. Returns new `avatarUrl`, frontend updates immediately

---

### 5. UI/UX Requirements

**Layout:**

- Profile header: Avatar (left), Name + Stats summary (right)
- Tab navigation: Overview | Match History | Friends
- Responsive: Stack vertically on mobile (<768px)

**Design System (Shadcn-Svelte):**

- Use `Card` for profile sections
- Use `Avatar` component with fallback (initials)
- Use `Table` for match history
- Use `Badge` for online/offline status
- Use `Progress` for win rate visualization
- Use `Button` variants: primary (actions), outline (secondary), destructive
  (block)

**States:**

- Loading: Skeleton placeholders for profile
- Empty: "No matches yet" with CTA to play
- Error: Toast notification for failed uploads/updates

---

**Constraints:**

- Avatar max 2MB, resized server-side to 256x256 WebP
- Display name: 3-20 characters, alphanumeric + spaces only
- Match history pagination: 10 per page, max 100 total
- All profile data fetched via Eden Treaty (type-safe)
- SSR for initial profile load (SEO + performance)
- Design must be extensible for multiple game types

**Output Format:** For each component, provide:

1. Complete file path
2. Full implementation code
3. Any terminal commands needed

**Verification:**

- [ ] Own profile displays current user's data correctly
- [ ] Avatar upload accepts valid images, rejects >2MB
- [ ] Display name updates persist and show immediately
- [ ] Match history loads with pagination working
- [ ] Stats calculate correctly (wins/losses/win rate)
- [ ] Public profile shows other users' data (read-only)
- [ ] Friend actions (add/remove/block) function correctly
- [ ] Responsive layout works on mobile and desktop
- [ ] Loading and error states display appropriately
- [ ] Match schema supports multiple game types via `gameType` and `metadata`
