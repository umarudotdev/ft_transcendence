import type { GameState } from "../schemas/GameState";

const PLAYER_HITBOX_RADIUS = 3;
const BULLET_RADIUS = 4;

export interface HitEvent {
  bulletIndex: number;
  playerId: string;
  damage: number;
}

export function checkCollisions(state: GameState): HitEvent[] {
  const hits: HitEvent[] = [];
  const hitBulletIndices = new Set<number>();

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    if (hitBulletIndices.has(i)) continue;
    const bullet = state.bullets[i];

    for (const [sessionId, player] of state.players) {
      // Skip own bullets
      if (bullet.ownerId === sessionId) continue;
      // Skip disconnected or invincible players
      if (!player.connected) continue;
      if (player.invincibleUntil > state.tick) continue;

      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      const combinedRadius = PLAYER_HITBOX_RADIUS + BULLET_RADIUS;

      if (dx * dx + dy * dy < combinedRadius * combinedRadius) {
        hits.push({
          bulletIndex: i,
          playerId: sessionId,
          damage: bullet.damage,
        });
        hitBulletIndices.add(i);
        break; // Bullet can only hit one player
      }
    }
  }

  // Remove hit bullets (iterate in reverse to preserve indices)
  const sortedIndices = [...hitBulletIndices].sort((a, b) => b - a);
  for (const idx of sortedIndices) {
    state.bullets.splice(idx, 1);
  }

  return hits;
}
