<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { GameRenderer } from './renderer';
	import {
		DEFAULT_CONFIG,
		type GameState,
		type GameConfig,
		type ClientMessage,
		type ServerMessage,
		type InputState
	} from '@ft/supercluster';

	// ========================================================================
	// Props
	// ========================================================================
	interface Props {
		wsUrl?: string;
		config?: GameConfig;
		debug?: boolean;
	}

	let { wsUrl = '', config = DEFAULT_CONFIG, debug = false }: Props = $props();

	// ========================================================================
	// State
	// ========================================================================
	let canvas: HTMLCanvasElement;
	let renderer: GameRenderer | null = null;
	let ws: WebSocket | null = null;
	let connected = $state(false);
	let gameState = $state<GameState | null>(null);

	// Input state
	const inputState: InputState = {
		forward: false,
		backward: false,
		left: false,
		right: false
	};

	let aimAngle = 0;

	// Sequence tracking for client-side prediction
	let inputSeq = 0; // Monotonically increasing sequence number
	let clientTick = 0; // Client's local tick counter

	// ========================================================================
	// Lifecycle
	// ========================================================================
	onMount(() => {
		// Initialize renderer (uses GAME_CONST and RENDERER_CONST directly)
		renderer = new GameRenderer(canvas, config);
		renderer.start();

		// Setup input handlers
		setupInputHandlers();

		// Connect to WebSocket if URL provided
		if (wsUrl) {
			connectWebSocket();
		}

		if (debug) {
			console.log('SuperCluster mounted');
		}
	});

	onDestroy(() => {
		// Cleanup
		cleanupInputHandlers();
		disconnectWebSocket();

		if (renderer) {
			renderer.dispose();
			renderer = null;
		}

		if (debug) {
			console.log('SuperCluster destroyed');
		}
	});

	// ========================================================================
	// WebSocket
	// ========================================================================
	function connectWebSocket(): void {
		if (!browser || !wsUrl) return;

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			connected = true;
			if (debug) console.log('WebSocket connected');
		};

		ws.onclose = () => {
			connected = false;
			if (debug) console.log('WebSocket disconnected');

			// Attempt reconnection after delay
			setTimeout(() => {
				if (wsUrl) connectWebSocket();
			}, 2000);
		};

		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
		};

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data) as ServerMessage;
			handleServerMessage(message);
		};
	}

	function disconnectWebSocket(): void {
		if (ws) {
			ws.close();
			ws = null;
		}
	}

	function sendMessage(message: ClientMessage): void {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	function handleServerMessage(message: ServerMessage): void {
		switch (message.type) {
			case 'state':
				gameState = message.state;
				if (renderer) {
					renderer.updateState(message.state);
				}
				break;

			case 'countdown':
				if (debug) console.log('Countdown:', message.seconds);
				break;

			case 'hit':
				if (debug) console.log('Hit:', message.targetId, 'Points:', message.points);
				break;

			case 'damage':
				if (debug) console.log('Damage! Lives:', message.lives);
				break;

			case 'gameOver':
				if (debug) console.log('Game Over! Score:', message.finalScore);
				break;

			case 'wave':
				if (debug) console.log('Wave:', message.waveNumber);
				break;
		}
	}

	// ========================================================================
	// Input Handling
	// ========================================================================
	let mousePressed = false;

	function setupInputHandlers(): void {
		if (!browser) return;
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		canvas.addEventListener('mousemove', handleMouseMove);
		canvas.addEventListener('mousedown', handleMouseDown);
		canvas.addEventListener('mouseup', handleMouseUp);
	}

	function cleanupInputHandlers(): void {
		if (!browser) return;
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
		canvas?.removeEventListener('mousemove', handleMouseMove);
		canvas?.removeEventListener('mousedown', handleMouseDown);
		canvas?.removeEventListener('mouseup', handleMouseUp);
	}

	function handleKeyDown(event: KeyboardEvent): void {
		const key = event.key.toLowerCase();
		let changed = false;

		switch (key) {
			case 'w':
			case 'arrowup':
				if (!inputState.forward) {
					inputState.forward = true;
					changed = true;
				}
				break;
			case 's':
			case 'arrowdown':
				if (!inputState.backward) {
					inputState.backward = true;
					changed = true;
				}
				break;
			case 'a':
			case 'arrowleft':
				if (!inputState.left) {
					inputState.left = true;
					changed = true;
				}
				break;
			case 'd':
			case 'arrowright':
				if (!inputState.right) {
					inputState.right = true;
					changed = true;
				}
				break;
		}

		if (changed) {
			inputSeq++;
			sendMessage({ type: 'input', seq: inputSeq, tick: clientTick, keys: { ...inputState } });
			// Also update local renderer for immediate feedback
			renderer?.setInput(inputState);
		}
	}

	function handleKeyUp(event: KeyboardEvent): void {
		const key = event.key.toLowerCase();
		let changed = false;

		switch (key) {
			case 'w':
			case 'arrowup':
				if (inputState.forward) {
					inputState.forward = false;
					changed = true;
				}
				break;
			case 's':
			case 'arrowdown':
				if (inputState.backward) {
					inputState.backward = false;
					changed = true;
				}
				break;
			case 'a':
			case 'arrowleft':
				if (inputState.left) {
					inputState.left = false;
					changed = true;
				}
				break;
			case 'd':
			case 'arrowright':
				if (inputState.right) {
					inputState.right = false;
					changed = true;
				}
				break;
		}

		if (changed) {
			inputSeq++;
			sendMessage({ type: 'input', seq: inputSeq, tick: clientTick, keys: { ...inputState } });
			// Also update local renderer for immediate feedback
			renderer?.setInput(inputState);
		}
	}

	function handleMouseMove(event: MouseEvent): void {
		// Calculate aim angle based on mouse position relative to canvas center
		// The aim dot points toward where the mouse cursor is on screen
		const rect = canvas.getBoundingClientRect();
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const dx = event.clientX - rect.left - centerX;
		const dy = event.clientY - rect.top - centerY;

		// atan2(dx, dy) because:
		// - dx: positive = right on screen
		// - dy: positive = down on screen = forward (angle 0)
		// This gives: 0 = down/forward, PI/2 = right, PI = up, -PI/2 = left
		aimAngle = Math.atan2(dx, dy);

		inputSeq++;
		sendMessage({ type: 'aim', seq: inputSeq, angle: aimAngle });
		renderer?.setAimAngle(aimAngle);
	}

	function handleMouseDown(_event: MouseEvent): void {
		mousePressed = true;
		renderer?.setMousePressed(true);
	}

	function handleMouseUp(_event: MouseEvent): void {
		mousePressed = false;
		renderer?.setMousePressed(false);
	}

	// ========================================================================
	// Public Methods (for parent component)
	// ========================================================================
	export function sendReady(): void {
		sendMessage({ type: 'ready' });
	}

	export function getGameState(): GameState | null {
		return gameState;
	}

	export function isConnected(): boolean {
		return connected;
	}
</script>

<div class="supercluster-container">
	<canvas bind:this={canvas} class="supercluster-canvas"></canvas>

	{#if debug && gameState}
		<div class="debug-overlay">
			<p>Score: {gameState.score}</p>
			<p>Lives: {gameState.ship.lives}</p>
			<p>Wave: {gameState.wave}</p>
			<p>Status: {gameState.gameStatus}</p>
			<p>Connected: {connected}</p>
		</div>
	{/if}
</div>

<style>
	.supercluster-container {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 400px;
	}

	.supercluster-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.debug-overlay {
		position: absolute;
		top: 10px;
		left: 10px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 10px;
		font-family: monospace;
		font-size: 12px;
		border-radius: 4px;
	}

	.debug-overlay p {
		margin: 0 0 4px 0;
	}
</style>
