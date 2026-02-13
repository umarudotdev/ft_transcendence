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

    // Create asteroids (as children of world so they rotate with planet)
    this.asteroids = new AsteroidRenderer();
    this.world.group.add(this.asteroids.group);

    // Create ship in world space (uses GAME_CONST and RENDERER_CONST directly)
    this.ship = new ShipRenderer();
    scene.add(this.ship.group);

    // Create projectiles under world group so they share the same authoritative
    // sphere frame as server projectile state.
    this.projectiles = new ProjectileRenderer();
    this.world.group.add(this.projectiles.group);

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
   * Update projectiles separately (needs camera position for shader)
   * Called from GameRenderer after setting camera position on projectiles
   */
  updateProjectiles(_deltaTime: number): void {}

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
