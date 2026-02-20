import type { GameState } from "../schemas/GameState";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../config";
import { MAX_ROTATION_SPEED } from "./constants";

/** Rotate `current` toward `target` by at most `maxDelta`, using shortest arc. */
export function rotateToward(
  current: number,
  target: number,
  maxDelta: number
): number {
  // Normalize diff to [-PI, PI] using atan2 for correct sign handling
  const diff = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current)
  );

  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

export function applyMovement(state: GameState, dt: number) {
  // Move players and rotate aim
  for (const [, player] of state.players) {
    if (!player.connected) continue;
    player.aimAngle = rotateToward(
      player.aimAngle,
      player.desiredAimAngle,
      MAX_ROTATION_SPEED * dt
    );
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
