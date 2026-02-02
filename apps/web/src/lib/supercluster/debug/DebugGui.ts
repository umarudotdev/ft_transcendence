import GUI from 'lil-gui';
import type { GameRenderer } from '../renderer/GameRenderer';
import type { GameConfig, RendererConfig } from '@ft/supercluster';

// ============================================================================
// Debug GUI
// lil-gui controls for debugging and tweaking the game renderer
// ============================================================================
export class DebugGui {
	private gui: GUI;
	private renderer: GameRenderer;

	// Bindable state (lil-gui needs object properties)
	private state = {
		// Renderer config
		showAxes: false,
		forceFieldOpacityFront: 0.4,
		forceFieldOpacityBack: 0.1,
		forceFieldDetail: 2,
		forceFieldColor: '#00ffaa',

		// Ship visual config
		shipRotationSpeed: 10,
		aimDotSize: 1.5,
		aimDotColor: '#ffff00',
		aimDotOrbitRadius: 12,

		// Game config
		gameSphereRadius: 100,
		forceFieldRadius: 95,
		planetRadius: 70,

		// Ship position (for debugging)
		shipPhi: Math.PI / 2,
		shipTheta: Math.PI / 2,
		shipAimAngle: 0,
	};

	constructor(renderer: GameRenderer, container?: HTMLElement) {
		this.renderer = renderer;
		this.gui = new GUI({ container, title: 'SuperCluster Debug' });

		this.setupRendererControls();
		this.setupForceFieldControls();
		this.setupShipVisualControls();
		this.setupGameConfigControls();
		this.setupShipControls();
	}

	private setupRendererControls(): void {
		const folder = this.gui.addFolder('Renderer');

		folder.add(this.state, 'showAxes').name('Show Axes').onChange((value: boolean) => {
			this.renderer.setAxesVisible(value);
		});

		folder.open();
	}

	private setupForceFieldControls(): void {
		const folder = this.gui.addFolder('Force Field');

		folder.add(this.state, 'forceFieldDetail', 0, 5, 1)
			.name('Detail (0-5)')
			.onChange((value: number) => {
				this.renderer.setForceFieldDetail(value);
			});

		folder.addColor(this.state, 'forceFieldColor')
			.name('Color')
			.onChange((value: string) => {
				// Convert hex string to number
				const colorNum = Number.parseInt(value.replace('#', ''), 16);
				this.renderer.setForceFieldColor(colorNum);
			});

		folder.add(this.state, 'forceFieldOpacityFront', 0, 1, 0.05)
			.name('Opacity Front')
			.onChange(() => {
				this.renderer.setForceFieldOpacity(
					this.state.forceFieldOpacityFront,
					this.state.forceFieldOpacityBack
				);
			});

		folder.add(this.state, 'forceFieldOpacityBack', 0, 1, 0.05)
			.name('Opacity Back')
			.onChange(() => {
				this.renderer.setForceFieldOpacity(
					this.state.forceFieldOpacityFront,
					this.state.forceFieldOpacityBack
				);
			});

		folder.open();
	}

	private setupShipVisualControls(): void {
		const folder = this.gui.addFolder('Ship & Aim');

		folder.add(this.state, 'shipRotationSpeed', 1, 30, 1)
			.name('Rotation Speed')
			.onChange((value: number) => {
				this.renderer.setShipRotationSpeed(value);
			});

		folder.add(this.state, 'aimDotSize', 0.5, 5, 0.5)
			.name('Aim Dot Size')
			.onChange((value: number) => {
				this.renderer.setAimDotSize(value);
			});

		folder.addColor(this.state, 'aimDotColor')
			.name('Aim Dot Color')
			.onChange((value: string) => {
				const colorNum = Number.parseInt(value.replace('#', ''), 16);
				this.renderer.setAimDotColor(colorNum);
			});

		folder.add(this.state, 'aimDotOrbitRadius', 8, 30, 1)
			.name('Aim Dot Orbit')
			.onChange((value: number) => {
				this.renderer.setAimDotOrbitRadius(value);
			});

		folder.open();
	}

	private setupGameConfigControls(): void {
		const folder = this.gui.addFolder('Game Config');

		folder.add(this.state, 'gameSphereRadius', 50, 200, 5)
			.name('Game Sphere R')
			.onChange(() => this.applyGameConfig());

		folder.add(this.state, 'forceFieldRadius', 50, 200, 5)
			.name('Force Field R')
			.onChange(() => this.applyGameConfig());

		folder.add(this.state, 'planetRadius', 30, 150, 5)
			.name('Planet R')
			.onChange(() => this.applyGameConfig());

		folder.close();
	}

	private setupShipControls(): void {
		const folder = this.gui.addFolder('Ship State');

		// Phi/Theta control the planet rotation (ship is visually fixed)
		// This simulates where the ship is "logically" on the planet surface
		folder.add(this.state, 'shipPhi', 0.01, Math.PI - 0.01, 0.05)
			.name('Phi (rotates planet X)')
			.onChange(() => this.updateShipPosition());

		folder.add(this.state, 'shipTheta', 0, Math.PI * 2, 0.05)
			.name('Theta (rotates planet Y)')
			.onChange(() => this.updateShipPosition());

		folder.add(this.state, 'shipAimAngle', -Math.PI, Math.PI, 0.05)
			.name('Aim Angle')
			.onChange(() => this.updateShipPosition());

		folder.open();
	}

	private applyGameConfig(): void {
		// GameRenderer.updateConfig expects full config, so we provide all values
		this.renderer.updateConfig({
			gameSphereRadius: this.state.gameSphereRadius,
			forceFieldRadius: this.state.forceFieldRadius,
			planetRadius: this.state.planetRadius,
			shipSpeed: 0.02,
			projectileSpeed: 0.05,
			projectileLifetime: 120,
			tickRate: 60,
		});
	}

	private updateShipPosition(): void {
		// This requires access to ship directly - we'll add a method to GameRenderer
		this.renderer.updateShipDebug({
			position: { phi: this.state.shipPhi, theta: this.state.shipTheta },
			aimAngle: this.state.shipAimAngle,
			lives: 3,
			invincible: false,
		});
	}

	// Sync GUI state from external changes
	syncFromConfig(config: GameConfig, rendererConfig: RendererConfig): void {
		this.state.gameSphereRadius = config.gameSphereRadius;
		this.state.forceFieldRadius = config.forceFieldRadius;
		this.state.planetRadius = config.planetRadius;
		this.state.showAxes = rendererConfig.showAxes;
		this.state.forceFieldOpacityFront = rendererConfig.forceFieldOpacity;
		this.state.forceFieldOpacityBack = rendererConfig.forceFieldBackFade;

		// Update GUI display
		this.gui.controllersRecursive().forEach(c => c.updateDisplay());
	}

	dispose(): void {
		this.gui.destroy();
	}
}
