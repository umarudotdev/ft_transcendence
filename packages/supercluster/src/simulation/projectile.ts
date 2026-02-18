import { Vec3 as GlVec3, type Vec3Like } from "gl-matrix";

import type { ProjectileState } from "../types";

import { GAME_CONST } from "../constants";
import {
  applyShipInputDelta,
  normalizeVec3,
  resolveReferenceBasis,
  stepSurfaceMotionState,
  type ShipInputDelta,
} from "./movement";

const EPS = 1e-8;

function aimAngleToWorldDirection(
  shipPosition: Vec3Like,
  shipDirection: Vec3Like,
  aimAngle: number
): Vec3Like {
  const basis = resolveReferenceBasis(shipPosition, shipDirection);
  const aimDir = GlVec3.create();
  GlVec3.scale(aimDir, basis.forward, Math.cos(aimAngle));
  GlVec3.scaleAndAdd(aimDir, aimDir, basis.right, Math.sin(aimAngle));
  if (GlVec3.squaredLength(aimDir) <= EPS) {
    return normalizeVec3(basis.forward);
  }
  GlVec3.normalize(aimDir, aimDir);
  return [aimDir[0], aimDir[1], aimDir[2]];
}

export function spawnProjectilesFromAim(
  nextProjectileId: number,
  shipPosition: Vec3Like,
  shipDirection: Vec3Like,
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
        aimAngleToWorldDirection(spawnPosition, shipDirection, aimAngle)
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
          aimAngleToWorldDirection(
            spawnPosition,
            shipDirection,
            aimAngle + offset
          )
        ),
        ageTicks: 0,
      });
    }
  }

  return { projectiles, nextProjectileId };
}

export function stepProjectiles(
  projectiles: readonly ProjectileState[],
  deltaTicks: number,
  shipDelta: ShipInputDelta
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
    const worldMotion = applyShipInputDelta(
      steppedMotion.position,
      steppedMotion.direction,
      shipDelta
    );

    stepped.push({
      ...projectile,
      position: normalizeVec3(worldMotion.position),
      direction: normalizeVec3(worldMotion.direction),
      ageTicks,
    });
  }

  return stepped;
}
