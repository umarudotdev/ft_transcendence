import { DEFAULT_GAMEPLAY, createWaveArray } from "@ft/supercluster";
import * as THREE from "three";

import { AsteroidRenderer } from "./Asteroid";
import { BulletRenderer } from "./Bullet";
import { CollisionSystem } from "./CollisionSystem";
import { ShipRenderer } from "./Ship";
import { WorldRenderer } from "./World";

// ============================================================================
// Game Stage
// Container for all game objects (world, ship, asteroids, bullets)
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
  readonly bullets: BulletRenderer;
  readonly collisionSystem: CollisionSystem;

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

    // Create bullets in world space (not planet children)
    // This ensures bullets travel at absolute speed regardless of ship movement
    this.bullets = new BulletRenderer();
    scene.add(this.bullets.group);

    // Create collision system (uses GAME_CONST directly)
    this.collisionSystem = new CollisionSystem();
  }

  /**
   * Initialize/reset game objects to starting state
   * Called by constructor and on game restart
   */
  initialize(): void {
    // Clear any existing asteroids and bullets
    this.asteroids.clear();
    this.bullets.clear();

    // Spawn initial asteroids using wave config
    this.asteroids.spawnMultiple(
      createWaveArray(DEFAULT_GAMEPLAY.asteroidWave)
    );

    // Reset ship visual state
    this.ship.updateFromState(
      {
        position: { phi: Math.PI / 2, theta: Math.PI / 2 },
        aimAngle: 0,
        lives: DEFAULT_GAMEPLAY.shipLives,
        invincible: DEFAULT_GAMEPLAY.shipInvincible,
        invincibleTicks: 0,
        cooldownLevel: 0,
        rayCountLevel: 0,
      },
      0,
      0
    );
  }

  /**
   * Update all game objects per frame
   * @param deltaTime - Time since last frame in seconds
   * @param cameraPosition - Camera position for shader updates
   */
  update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    this.asteroids.update(deltaTime);
    this.world.update(cameraPosition);
  }

  /**
   * Update bullets separately (needs camera position for shader)
   * Called from GameRenderer after setting camera position on bullets
   */
  updateBullets(deltaTime: number): void {
    this.bullets.update(deltaTime);
  }

  /**
   * Clean up all game objects
   */
  dispose(): void {
    this.world.dispose();
    this.ship.dispose();
    this.asteroids.dispose();
    this.bullets.dispose();
  }
}
