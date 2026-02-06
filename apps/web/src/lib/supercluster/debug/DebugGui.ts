import { GAME_CONST, type GameConfig } from '@ft/supercluster';

import GUI from 'lil-gui';

import { RENDERER_CONST } from '../constants/renderer';
import type { GameRenderer } from '../renderer/GameRenderer';

// ============================================================================
// Debug GUI
// lil-gui controls for debugging and tweaking the game renderer
// Uses GAME_CONST for immutable values, GameConfig for GUI-controlled values
// ============================================================================
export class DebugGui {
	private gui: GUI;
	private renderer: GameRenderer;

	// Bindable state (lil-gui needs object properties)
	// All values initialized from config in constructor (single source of truth)
	private state = {
		// Renderer config (initialized from RENDERER_CONST in constructor)
		forceFieldColor: '#000000',

		// Ship visual config (initialized from RENDERER_CONST in constructor)
		aimDotColor: '#000000',

		// Bullet config (initialized from GameConfig in constructor)
		bulletLifetime: 0,
		bulletCooldown: 0,
		bulletRayCount: 0,
		bulletSpreadAngle: 0,
		bulletColor: '#000000',
		bulletCount: 0, // Read-only display
		asteroidCount: 0 // Read-only display
	};

	// Interval IDs for count updates
	private bulletCountInterval: ReturnType<typeof setInterval> | null = null;
	private asteroidCountInterval: ReturnType<typeof setInterval> | null = null;

	constructor(renderer: GameRenderer, container?: HTMLElement) {
		this.renderer = renderer;
		this.gui = new GUI({ container, title: 'SuperCluster Debug' });

		// Initialize ALL state from actual config (single source of truth)
		const config = this.renderer.getConfig();

		// Renderer config (from RENDERER_CONST, but can be changed via GUI)
		this.state.forceFieldColor = `#${this.renderer.getForceFieldColor().toString(16).padStart(6, '0')}`;

		// Ship visual config (from RENDERER_CONST, but can be changed via GUI)
		this.state.aimDotColor = `#${RENDERER_CONST.AIM_DOT_COLOR.toString(16).padStart(6, '0')}`;

		// Bullet config from GameConfig (GUI-controlled values)
		this.state.bulletLifetime = config.projectile.lifetime / GAME_CONST.TICK_RATE; // ticks → sec
		this.state.bulletCooldown = config.projectile.cooldown / GAME_CONST.TICK_RATE; // ticks → sec
		this.state.bulletRayCount = config.projectile.rayCount;
		this.state.bulletSpreadAngle = (config.projectile.spreadAngle * 180) / Math.PI; // rad → deg
		this.state.bulletColor = `#${RENDERER_CONST.BULLET_COLOR.toString(16).padStart(6, '0')}`;

		this.setupForceFieldControls();
		this.setupShipVisualControls();
		this.setupBulletControls();
		this.setupAsteroidControls();
	}

	private setupForceFieldControls(): void {
		const folder = this.gui.addFolder('Force Field');

		folder
			.addColor(this.state, 'forceFieldColor')
			.name('Color')
			.onChange((value: string) => {
				// Convert hex string to number
				const colorNum = Number.parseInt(value.replace('#', ''), 16);
				this.renderer.setForceFieldColor(colorNum);
			});

		folder.open();
	}

	private setupShipVisualControls(): void {
		const folder = this.gui.addFolder('Ship & Aim');

		folder
			.addColor(this.state, 'aimDotColor')
			.name('Aim Dot Color')
			.onChange((value: string) => {
				const colorNum = Number.parseInt(value.replace('#', ''), 16);
				this.renderer.setAimDotColor(colorNum);
			});

		folder.open();
	}

	private setupBulletControls(): void {
		const folder = this.gui.addFolder('Bullets');

		folder
			.add(this.state, 'bulletLifetime', 0.5, 5, 0.1)
			.name('Lifetime (s)')
			.onChange((value: number) => {
				// Convert seconds to ticks for GameConfig
				this.renderer.updateProjectileConfig({
					lifetime: value * GAME_CONST.TICK_RATE
				});
			});

		// Note: Bullet speed comes from GAME_CONST.PROJECTILE_SPEED (immutable)

		folder
			.add(this.state, 'bulletCooldown', 0.05, 1, 0.05)
			.name('Cooldown (s)')
			.onChange((value: number) => {
				// Convert seconds to ticks for GameConfig
				this.renderer.updateProjectileConfig({
					cooldown: value * GAME_CONST.TICK_RATE
				});
			});

		folder
			.add(this.state, 'bulletRayCount', 1, 5, 1)
			.name('Ray Count')
			.onChange((value: number) => {
				this.renderer.updateProjectileConfig({ rayCount: value });
			});

		folder
			.add(this.state, 'bulletSpreadAngle', 0, 45, 1)
			.name('Spread (deg)')
			.onChange((value: number) => {
				// Convert degrees to radians for GameConfig
				this.renderer.updateProjectileConfig({
					spreadAngle: (value * Math.PI) / 180
				});
			});

		folder
			.addColor(this.state, 'bulletColor')
			.name('Color')
			.onChange((value: string) => {
				const colorNum = Number.parseInt(value.replace('#', ''), 16);
				this.renderer.setBulletColor(colorNum);
			});

		// Read-only bullet count display - updated via interval
		const countController = folder.add(this.state, 'bulletCount').name('Active Bullets').disable();

		// Update bullet count every 100ms
		this.bulletCountInterval = setInterval(() => {
			this.state.bulletCount = this.renderer.getBulletCount();
			countController.updateDisplay();
		}, 100);

		// Clear all bullets button
		folder.add({ clear: () => this.renderer.clearBullets() }, 'clear').name('Clear All Bullets');

		folder.open();
	}

	private setupAsteroidControls(): void {
		const folder = this.gui.addFolder('Asteroids');

		// Read-only asteroid count display - updated via interval
		const countController = folder
			.add(this.state, 'asteroidCount')
			.name('Active Asteroids')
			.disable();

		// Update asteroid count every 100ms
		this.asteroidCountInterval = setInterval(() => {
			this.state.asteroidCount = this.renderer.getAsteroidCount();
			countController.updateDisplay();
		}, 100);

		folder.open();
	}

	// Sync GUI state from external changes
	syncFromConfig(config: GameConfig): void {
		// Projectile mechanics from GameConfig (convert ticks → seconds for GUI)
		this.state.bulletLifetime = config.projectile.lifetime / GAME_CONST.TICK_RATE;
		this.state.bulletCooldown = config.projectile.cooldown / GAME_CONST.TICK_RATE;
		this.state.bulletRayCount = config.projectile.rayCount;
		this.state.bulletSpreadAngle = (config.projectile.spreadAngle * 180) / Math.PI;

		// Update GUI display
		this.gui.controllersRecursive().forEach((c) => c.updateDisplay());
	}

	dispose(): void {
		if (this.bulletCountInterval !== null) {
			clearInterval(this.bulletCountInterval);
			this.bulletCountInterval = null;
		}
		if (this.asteroidCountInterval !== null) {
			clearInterval(this.asteroidCountInterval);
			this.asteroidCountInterval = null;
		}
		this.gui.destroy();
	}
}
