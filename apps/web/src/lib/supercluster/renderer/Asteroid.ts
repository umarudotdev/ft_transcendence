import { GAME_CONST, GAMEPLAY_CONST } from '@ft/supercluster';
import * as THREE from 'three';

import { RENDERER_CONST } from '../constants/renderer';

// ============================================================================
// Asteroid Data
// ============================================================================
export interface AsteroidData {
	id: number;
	// Position as unit vector on sphere (x² + y² + z² = 1)
	position: THREE.Vector3;
	// Movement direction as unit vector tangent to sphere
	velocity: THREE.Vector3;
	// Self-rotation speeds (radians per second)
	rotationSpeedX: number;
	rotationSpeedY: number;
	// Current rotation angles
	rotationX: number;
	rotationY: number;
	// Size (1 = small, 2 = medium, 3 = large, 4 = huge)
	size: number;
	// Movement speed (radians per second on sphere surface)
	speed: number;
	// Hit state tracking
	isHit: boolean;
	hitTimer: number; // Time remaining until break (in seconds)
}

// ============================================================================
// Asteroid Renderer
// Uses InstancedMesh for efficient rendering of many asteroids
// Uses GAME_CONST for all physics/geometry constants
// ============================================================================
export class AsteroidRenderer {
	readonly instancedMesh: THREE.InstancedMesh;
	readonly group: THREE.Group;

	private asteroids: AsteroidData[] = [];
	private nextId = 0;

	// Reusable objects for matrix calculations
	private readonly _matrix = new THREE.Matrix4();
	private readonly _position = new THREE.Vector3();
	private readonly _quaternion = new THREE.Quaternion();
	private readonly _scale = new THREE.Vector3();
	private readonly _euler = new THREE.Euler();

	constructor(maxAsteroids = 100) {
		this.group = new THREE.Group();

		// Create shared geometry (rocky asteroid shape)
		const geometry = new THREE.IcosahedronGeometry(1, 0);

		// Create material with rocky asteroid appearance
		const material = new THREE.MeshStandardMaterial({
			color: RENDERER_CONST.ASTEROID_COLOR,
			roughness: RENDERER_CONST.ASTEROID_ROUGHNESS,
			metalness: RENDERER_CONST.ASTEROID_METALNESS,
			flatShading: true
		});

		// Create instanced mesh
		this.instancedMesh = new THREE.InstancedMesh(geometry, material, maxAsteroids);
		this.instancedMesh.count = 0; // Start with no visible instances
		this.instancedMesh.frustumCulled = false; // Always render (they're on a sphere)

		this.group.add(this.instancedMesh);
	}

	// ========================================================================
	// Spawn Asteroids
	// ========================================================================

	/**
	 * Spawn an asteroid at a random position on the sphere
	 */
	spawnRandom(size: number): AsteroidData {
		// Random position on unit sphere using spherical coordinates
		const phi = Math.acos(2 * Math.random() - 1); // 0 to PI (uniform distribution)
		const theta = Math.random() * Math.PI * 2; // 0 to 2*PI

		const position = new THREE.Vector3(
			Math.sin(phi) * Math.cos(theta),
			Math.cos(phi),
			Math.sin(phi) * Math.sin(theta)
		);

		// Random velocity direction tangent to sphere
		const velocity = this.randomTangentVector(position);

		// Random rotation speeds (uses RENDERER_CONST.ASTEROID_ROT_SPEED)
		const rotationSpeedX = (Math.random() - 0.5) * RENDERER_CONST.ASTEROID_ROT_SPEED;
		const rotationSpeedY = (Math.random() - 0.5) * RENDERER_CONST.ASTEROID_ROT_SPEED;

		// Random movement speed from GAME_CONST (rad/tick → rad/sec)
		const speedInRadPerTick =
			GAME_CONST.ASTEROID_SPEED_MIN +
			Math.random() * (GAME_CONST.ASTEROID_SPEED_MAX - GAME_CONST.ASTEROID_SPEED_MIN);
		const speed = speedInRadPerTick * GAME_CONST.TICK_RATE; // Convert to rad/sec

		const asteroid: AsteroidData = {
			id: this.nextId++,
			position,
			velocity,
			rotationSpeedX,
			rotationSpeedY,
			rotationX: Math.random() * Math.PI * 2,
			rotationY: Math.random() * Math.PI * 2,
			size,
			speed,
			isHit: false,
			hitTimer: 0
		};

		this.asteroids.push(asteroid);
		this.instancedMesh.count = this.asteroids.length;

		// Update this instance's matrix
		this.updateInstanceMatrix(this.asteroids.length - 1);

		return asteroid;
	}

	/**
	 * Spawn multiple asteroids with specified sizes
	 */
	spawnMultiple(sizes: number[]): void {
		for (const size of sizes) {
			this.spawnRandom(size);
		}
	}

	/**
	 * Generate a random unit vector tangent to the sphere at the given position
	 */
	private randomTangentVector(position: THREE.Vector3): THREE.Vector3 {
		// Create a random vector
		const random = new THREE.Vector3(
			Math.random() - 0.5,
			Math.random() - 0.5,
			Math.random() - 0.5
		).normalize();

		// Project out the component parallel to position (make it tangent)
		const tangent = random.sub(position.clone().multiplyScalar(random.dot(position)));
		tangent.normalize();

		return tangent;
	}

	// ========================================================================
	// Update
	// ========================================================================

	/**
	 * Update all asteroids (call each frame)
	 * @param deltaTime - seconds since last update
	 */
	update(deltaTime: number): void {
		// Track asteroids to break (can't modify array while iterating)
		const asteroidsToBreak: number[] = [];

		for (let i = 0; i < this.asteroids.length; i++) {
			const asteroid = this.asteroids[i];

			// Handle hit timer
			if (asteroid.isHit) {
				asteroid.hitTimer -= deltaTime;
				if (asteroid.hitTimer <= 0) {
					// Time's up! Break the asteroid
					asteroidsToBreak.push(asteroid.id);
					continue; // Skip updating matrix for this asteroid
				}
			}

			// Update self-rotation
			asteroid.rotationX += asteroid.rotationSpeedX * deltaTime;
			asteroid.rotationY += asteroid.rotationSpeedY * deltaTime;

			// Move along sphere surface
			this.moveOnSphere(asteroid, deltaTime);

			// Update instance matrix
			this.updateInstanceMatrix(i);
		}

		// Break asteroids after loop completes
		for (const id of asteroidsToBreak) {
			this.breakAsteroid(id);
		}

		// Update instance count if asteroids were broken
		this.instancedMesh.count = this.asteroids.length;

		// Tell Three.js that matrices and colors have changed
		this.instancedMesh.instanceMatrix.needsUpdate = true;
		if (this.instancedMesh.instanceColor) {
			this.instancedMesh.instanceColor.needsUpdate = true;
		}
	}

	/**
	 * Move an asteroid along the sphere surface in its velocity direction
	 */
	private moveOnSphere(asteroid: AsteroidData, deltaTime: number): void {
		// Angular distance to move this frame
		const angle = asteroid.speed * deltaTime;

		if (angle === 0) return;

		// Rotate position around the axis perpendicular to both position and velocity
		// This moves the asteroid along a great circle in the velocity direction
		const axis = new THREE.Vector3().crossVectors(asteroid.position, asteroid.velocity).normalize();

		// Create rotation quaternion
		const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

		// Rotate position
		asteroid.position.applyQuaternion(quat);
		asteroid.position.normalize(); // Prevent drift

		// Rotate velocity to stay tangent
		asteroid.velocity.applyQuaternion(quat);
		asteroid.velocity.normalize();
	}

	/**
	 * Update the instance matrix for a specific asteroid
	 */
	private updateInstanceMatrix(index: number): void {
		const asteroid = this.asteroids[index];

		// Position on sphere surface using GAME_CONST
		this._position.copy(asteroid.position).multiplyScalar(GAME_CONST.SPHERE_RADIUS);

		// Rotation: first orient to surface, then apply self-rotation
		// Create basis: normal (position), tangent, bitangent
		const normal = asteroid.position.clone();
		const tangent = asteroid.velocity.clone();
		const bitangent = new THREE.Vector3().crossVectors(normal, tangent);

		// Build rotation matrix from basis vectors
		const rotMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
		this._quaternion.setFromRotationMatrix(rotMatrix);

		// Apply self-rotation (around local X and Y axes)
		this._euler.set(asteroid.rotationX, asteroid.rotationY, 0);
		const selfRotation = new THREE.Quaternion().setFromEuler(this._euler);
		this._quaternion.multiply(selfRotation);

		// Scale based on size (uses GAMEPLAY_CONST.ASTEROID_DIAM)
		const visualSize = GAMEPLAY_CONST.ASTEROID_DIAM[asteroid.size - 1] || 2;
		this._scale.set(visualSize, visualSize, visualSize);

		// Compose matrix
		this._matrix.compose(this._position, this._quaternion, this._scale);

		// Set instance matrix
		this.instancedMesh.setMatrixAt(index, this._matrix);

		// Set color (red if hit, normal otherwise)
		if (asteroid.isHit) {
			this.instancedMesh.setColorAt(index, new THREE.Color(RENDERER_CONST.ASTEROID_HIT_COLOR));
		} else {
			this.instancedMesh.setColorAt(index, new THREE.Color(0xffffff)); // White (neutral tint)
		}
	}

	// ========================================================================
	// Hit & Remove Asteroids
	// ========================================================================

	/**
	 * Mark an asteroid as hit - it will turn red and break after delay
	 * @param id - Asteroid ID
	 * @param delay - Time in seconds before breaking (default 0.5s)
	 */
	markAsHit(id: number, delay = 0.5): boolean {
		const asteroid = this.asteroids.find((a) => a.id === id);
		if (!asteroid || asteroid.isHit) return false;

		asteroid.isHit = true;
		asteroid.hitTimer = delay;
		return true;
	}

	/**
	 * Remove an asteroid by ID
	 * Returns the removed asteroid data (for spawning smaller ones)
	 */
	remove(id: number): AsteroidData | null {
		const index = this.asteroids.findIndex((a) => a.id === id);
		if (index === -1) return null;

		const removed = this.asteroids[index];

		// Remove from array
		this.asteroids.splice(index, 1);

		// Update instance count
		this.instancedMesh.count = this.asteroids.length;

		// Rebuild all matrices after removal (indices shifted)
		for (let i = index; i < this.asteroids.length; i++) {
			this.updateInstanceMatrix(i);
		}

		this.instancedMesh.instanceMatrix.needsUpdate = true;

		return removed;
	}

	/**
	 * Break an asteroid into smaller pieces
	 * Removes the original and spawns 2-3 smaller ones at the same location
	 */
	breakAsteroid(id: number): AsteroidData[] {
		const asteroid = this.remove(id);
		if (!asteroid || asteroid.size <= 1) return [];

		const newSize = asteroid.size - 1;
		const count = 2 + Math.floor(Math.random() * 2); // 2-3 pieces
		const newAsteroids: AsteroidData[] = [];

		for (let i = 0; i < count; i++) {
			// Spawn at same position with slightly different velocity
			const newVelocity = this.randomTangentVector(asteroid.position);

			const newAsteroid: AsteroidData = {
				id: this.nextId++,
				position: asteroid.position.clone(),
				velocity: newVelocity,
				rotationSpeedX: (Math.random() - 0.5) * RENDERER_CONST.ASTEROID_FRAG_ROT,
				rotationSpeedY: (Math.random() - 0.5) * RENDERER_CONST.ASTEROID_FRAG_ROT,
				rotationX: Math.random() * Math.PI * 2,
				rotationY: Math.random() * Math.PI * 2,
				size: newSize,
				speed: asteroid.speed * RENDERER_CONST.ASTEROID_FRAG_SPEED_MULT,
				isHit: false,
				hitTimer: 0
			};

			this.asteroids.push(newAsteroid);
			newAsteroids.push(newAsteroid);
		}

		this.instancedMesh.count = this.asteroids.length;

		// Update new instance matrices
		for (let i = this.asteroids.length - count; i < this.asteroids.length; i++) {
			this.updateInstanceMatrix(i);
		}

		this.instancedMesh.instanceMatrix.needsUpdate = true;

		return newAsteroids;
	}

	// ========================================================================
	// Getters
	// ========================================================================

	getAsteroids(): readonly AsteroidData[] {
		return this.asteroids;
	}

	getAsteroidById(id: number): AsteroidData | undefined {
		return this.asteroids.find((a) => a.id === id);
	}

	getCount(): number {
		return this.asteroids.length;
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

	dispose(): void {
		this.instancedMesh.geometry.dispose();
		(this.instancedMesh.material as THREE.Material).dispose();
	}

	/**
	 * Remove all asteroids
	 */
	clear(): void {
		this.asteroids = [];
		this.instancedMesh.count = 0;
		this.instancedMesh.instanceMatrix.needsUpdate = true;
	}
}
