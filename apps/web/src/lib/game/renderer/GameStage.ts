import { createInitialShipState } from "@ft/supercluster";
import * as THREE from "three";

import { AsteroidRenderer } from "./Asteroid";
import { ProjectileRenderer } from "./Projectile";
import { ShipRenderer } from "./Ship";
import { WorldRenderer } from "./World";

// ============================================================================
// Game Stage
// Container for all game objects (world, ship, asteroids, projectiles)
//
// Stage Contract:
// - `world.group`: planet + force field container (identity in world mode).
// - `ship.group`: world-positioned ship from server snapshot.
// - `asteroids.group` / `projectiles.group`: scene-level snapshot entities.
//
// Responsibilities:
// - Creates and manages game object lifecycle
// - Provides update() for per-frame updates
// - Handles initialization and reset
//
// Does NOT handle:
// - Three.js infrastructure (renderer, scene, camera) - owned by GameRenderer
// - Game logic (movement, collisions) - handled by GameRenderer
// - Input handling - handled by GameRenderer/InputController
// ============================================================================
export class GameStage {
  readonly world: WorldRenderer;
  readonly ship: ShipRenderer;
  readonly asteroids: AsteroidRenderer;
  readonly projectiles: ProjectileRenderer;

  constructor(scene: THREE.Scene) {
    // Create world (planet + force field container)
    this.world = new WorldRenderer();
    scene.add(this.world.group);

    // Asteroids are scene-level snapshot entities.
    this.asteroids = new AsteroidRenderer();
    scene.add(this.asteroids.group);

    // Ship is world-positioned from snapshots.
    this.ship = new ShipRenderer();
    scene.add(this.ship.group);

    // Projectiles are scene-level snapshot entities.
    this.projectiles = new ProjectileRenderer();
    scene.add(this.projectiles.group);
  }

  /**
   * Initialize/reset game objects to starting state
   * Called by constructor and on game restart
   */
  initialize(): void {
    // In server-authority flow, renderer only mirrors snapshots.
    this.asteroids.clear();
    this.projectiles.clear();

    // Reset ship visual state
    this.ship.updateFromState(createInitialShipState(), 0, 0);
  }

  /**
   * Update all game objects per frame
   * @param deltaTime - Time since last frame in seconds
   * @param cameraPosition - Camera position for shader updates
   */
  update(_deltaTime: number, cameraPosition: THREE.Vector3): void {
    this.world.update(cameraPosition);
  }

  /**
   * Clean up all game objects
   */
  dispose(): void {
    this.world.dispose();
    this.ship.dispose();
    this.asteroids.dispose();
    this.projectiles.dispose();
  }
}
