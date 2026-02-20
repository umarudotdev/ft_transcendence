import { Vec3 as GlVec3, type Vec3Like } from "gl-matrix";

import type { NetVec3, ProjectileState } from "../types";

import { GAME_CONST } from "../constants";
import {
  normalizeVec3,
  resolveReferenceBasis,
  stepSurfaceMotionState,
  applyShipInputDelta,
  type ShipInputDelta,
} from "./movement";

const EPS = 1e-8;

// Scratch buffer for aim direction computation
const _AIM = GlVec3.create();

function aimAngleToWorldDirection(
  shipPosition: Vec3Like,
  shipDirection: Vec3Like,
  aimAngle: number
): NetVec3 {
  const basis = resolveReferenceBasis(shipPosition, shipDirection);
  GlVec3.scale(_AIM, basis.forward, Math.cos(aimAngle));
  GlVec3.scaleAndAdd(_AIM, _AIM, basis.right, Math.sin(aimAngle));
  if (GlVec3.squaredLength(_AIM) <= EPS) {
    return [basis.forward[0], basis.forward[1], basis.forward[2]];
  }
  GlVec3.normalize(_AIM, _AIM);
  return [_AIM[0], _AIM[1], _AIM[2]];
}

export function spawnProjectilesFromAim(
  nextProjectileId: number,
  shipPosition: Vec3Like,
  shipDirection: Vec3Like,
  aimAngle: number,
  rayCount = 1
): { projectiles: ProjectileState[]; nextProjectileId: number } {
  const count: number = Math.max(1, rayCount);
  const spread: number = GAME_CONST.PROJECTILE_SPREAD_ANGLE;
  const spawnPos: NetVec3 = [shipPosition[0], shipPosition[1], shipPosition[2]];
  normalizeVec3(spawnPos, spawnPos);

  const projectiles: ProjectileState[] = [];

  if (count === 1) {
    projectiles.push({
      id: nextProjectileId++,
      position: [spawnPos[0], spawnPos[1], spawnPos[2]],
      direction: aimAngleToWorldDirection(spawnPos, shipDirection, aimAngle),
      ageTicks: 0,
    });
  } else {
    const halfSpread = ((count - 1) * spread) / 2;
    for (let i = 0; i < count; i++) {
      const offset: number = -halfSpread + i * spread;
      projectiles.push({
        id: nextProjectileId++,
        position: [spawnPos[0], spawnPos[1], spawnPos[2]],
        direction: aimAngleToWorldDirection(
          spawnPos,
          shipDirection,
          aimAngle + offset
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
  const stepAngle: number = GAME_CONST.PROJECTILE_SPEED * deltaTicks;

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
      position: worldMotion.position,
      direction: worldMotion.direction,
      ageTicks,
    });
  }

  return stepped;
}
