import { GAME_CONST } from "../constants";
import type { ProjectileState, Vec3 } from "../types";
import {
  aimDirectionAtPosition,
  normalizeVec3,
  stepSurfaceMotionState,
} from "./movement";

function createProjectileDirection(shipPosition: Vec3, aimAngle: number): Vec3 {
  return aimDirectionAtPosition(shipPosition, aimAngle);
}

export function spawnProjectilesFromAim(
  nextProjectileId: number,
  shipPosition: Vec3,
  aimAngle: number,
  rayCount = 1
): { projectiles: ProjectileState[]; nextProjectileId: number } {
  const count = Math.max(1, rayCount);
  const spread = GAME_CONST.PROJECTILE_SPREAD_ANGLE;
  const spawnPosition = normalizeVec3(shipPosition);

  const projectiles: ProjectileState[] = [];

  if (count === 1) {
    projectiles.push({
      id: nextProjectileId++,
      position: normalizeVec3(spawnPosition),
      direction: normalizeVec3(
        createProjectileDirection(spawnPosition, aimAngle)
      ),
      ageTicks: 0,
    });
  } else {
    const halfSpread = ((count - 1) * spread) / 2;
    for (let i = 0; i < count; i++) {
      const offset = -halfSpread + i * spread;
      projectiles.push({
        id: nextProjectileId++,
        position: normalizeVec3(spawnPosition),
        direction: normalizeVec3(
          createProjectileDirection(spawnPosition, aimAngle + offset)
        ),
        ageTicks: 0,
      });
    }
  }

  return { projectiles, nextProjectileId };
}

export function stepProjectiles(
  projectiles: readonly ProjectileState[],
  deltaTicks: number
): ProjectileState[] {
  if (projectiles.length === 0) return [];
  const stepAngle = GAME_CONST.PROJECTILE_SPEED * deltaTicks;

  const stepped: ProjectileState[] = [];
  for (const projectile of projectiles) {
    const ageTicks = projectile.ageTicks + deltaTicks;
    if (ageTicks >= GAME_CONST.PROJECTILE_AGE_TICKS) continue;

    const steppedMotion = stepSurfaceMotionState(
      projectile.position,
      projectile.direction,
      stepAngle
    );

    stepped.push({
      ...projectile,
      position: normalizeVec3(steppedMotion.position),
      direction: normalizeVec3(steppedMotion.direction),
      ageTicks,
    });
  }

  return stepped;
}
