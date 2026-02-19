import type { GameState } from "../schemas/GameState";

const PLAYER_HITBOX_RADIUS = 3;
const BULLET_RADIUS = 4;
const GRAZE_RADIUS = 20;

export interface HitEvent {
  bulletIndex: number;
  playerId: string;
  damage: number;
}

export interface GrazeEvent {
  playerId: string;
  bulletX: number;
  bulletY: number;
}

export interface CollisionResult {
  hits: HitEvent[];
  grazes: GrazeEvent[];
}

export function checkCollisions(state: GameState): CollisionResult {
  const hits: HitEvent[] = [];
  const grazes: GrazeEvent[] = [];
  const hitBulletIndices = new Set<number>();

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    if (hitBulletIndices.has(i)) continue;
    const bullet = state.bullets[i];

    for (const [sessionId, player] of state.players) {
      // Skip own bullets
      if (bullet.ownerId === sessionId) continue;
      // Skip disconnected players
      if (!player.connected) continue;

      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      const distSq = dx * dx + dy * dy;

      // Skip invincible players for hit detection but still allow graze
      if (player.invincibleUntil <= state.tick) {
        const hitRadius = PLAYER_HITBOX_RADIUS + BULLET_RADIUS;
        if (distSq < hitRadius * hitRadius) {
          hits.push({
            bulletIndex: i,
            playerId: sessionId,
            damage: bullet.damage,
          });
          hitBulletIndices.add(i);
          break;
        }
      }

      // Graze detection: within graze radius but not a hit, and not already grazed
      if (
        distSq < GRAZE_RADIUS * GRAZE_RADIUS &&
        !bullet.grazedPlayers.has(sessionId)
      ) {
        bullet.grazedPlayers.add(sessionId);
        grazes.push({
          playerId: sessionId,
          bulletX: bullet.x,
          bulletY: bullet.y,
        });
      }
    }
  }

  // Remove hit bullets (iterate in reverse to preserve indices)
  const sortedIndices = [...hitBulletIndices].sort((a, b) => b - a);
  for (const idx of sortedIndices) {
    state.bullets.splice(idx, 1);
  }

  return { hits, grazes };
}
