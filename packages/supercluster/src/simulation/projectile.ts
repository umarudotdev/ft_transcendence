import { GAME_CONST } from "../constants";
import type { ProjectileState, Vec3 } from "../types";
import { normalizeVec3, stepSurfaceMotionState } from "./movement";

function createProjectileDirection(aimAngle: number): Vec3 {
  return {
    x: Math.sin(aimAngle),
    y: Math.cos(aimAngle),
    z: 0,
  };
}

export function spawnProjectilesFromAim(
  nextProjectileId: number,
  aimAngle: number,
  rayCount = 1
): { projectiles: ProjectileState[]; nextProjectileId: number } {
  const count = Math.max(1, rayCount);
  const spread = GAME_CONST.PROJECTILE_SPREAD_ANGLE;
  const spawnPosition = {
    x: GAME_CONST.SHIP_INITIAL_POS.x,
    y: GAME_CONST.SHIP_INITIAL_POS.y,
    z: GAME_CONST.SHIP_INITIAL_POS.z,
  };

  const projectiles: ProjectileState[] = [];

  if (count === 1) {
    projectiles.push({
      id: nextProjectileId++,
      position: normalizeVec3(spawnPosition),
      direction: normalizeVec3(createProjectileDirection(aimAngle)),
      ageTicks: 0,
    });
  } else {
    const halfSpread = ((count - 1) * spread) / 2;
    for (let i = 0; i < count; i++) {
      const offset = -halfSpread + i * spread;
      projectiles.push({
        id: nextProjectileId++,
        position: normalizeVec3(spawnPosition),
        direction: normalizeVec3(createProjectileDirection(aimAngle + offset)),
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
