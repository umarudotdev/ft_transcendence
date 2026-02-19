import type { GameState } from "../schemas/GameState";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../config";

export function applyMovement(state: GameState, dt: number) {
  // Move players
  for (const [, player] of state.players) {
    if (!player.connected) continue;
    player.applyMovement(dt);
  }

  // Move bullets, apply angular velocity, and remove out-of-bounds
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];

    // Rotate velocity vector if bullet has angular velocity
    if (bullet.angularVelocity !== 0) {
      const angle = Math.atan2(bullet.velocityY, bullet.velocityX);
      const newAngle = angle + bullet.angularVelocity * dt;
      bullet.velocityX = Math.cos(newAngle) * bullet.speed;
      bullet.velocityY = Math.sin(newAngle) * bullet.speed;
    }

    bullet.x += bullet.velocityX * dt;
    bullet.y += bullet.velocityY * dt;

    if (
      bullet.x < -10 ||
      bullet.x > CANVAS_WIDTH + 10 ||
      bullet.y < -10 ||
      bullet.y > CANVAS_HEIGHT + 10
    ) {
      state.bullets.splice(i, 1);
    }
  }
}
