<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { GameRenderer } from './renderer';
	import {
		type GameState,
		type ClientMessage,
		type ServerMessage,
		type InputState
	} from '@ft/supercluster';

	// ========================================================================
	// Props
	// ========================================================================
	interface Props {
		wsUrl?: string;
		debug?: boolean;
	}

	let { wsUrl = '', debug = false }: Props = $props();

	// ========================================================================
	// State
	// ========================================================================
	let canvas: HTMLCanvasElement;
	let renderer: GameRenderer | null = null;
	let ws: WebSocket | null = null;
	let connected = $state(false);
	let gameState = $state<GameState | null>(null);
	let isMounted = false;
	let shouldReconnect = true;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
	let clientTick = 0; // Logical client tick for input ordering

	// ========================================================================
	// Lifecycle
	// ========================================================================
	onMount(() => {
		isMounted = true;
		shouldReconnect = true;

		// Initialize renderer (uses GAME_CONST and RENDERER_CONST directly)
		renderer = new GameRenderer(canvas);
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
		isMounted = false;
		shouldReconnect = false;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}

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
		if (ws && ws.readyState === WebSocket.OPEN) return;
		if (ws && ws.readyState === WebSocket.CONNECTING) return;

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			connected = true;
			sendMessage({ type: 'ready' });
			if (debug) console.log('WebSocket connected');
		};

		ws.onclose = () => {
			connected = false;
			ws = null;
			if (debug) console.log('WebSocket disconnected');

			// Attempt reconnection after delay
			if (isMounted && shouldReconnect) {
				reconnectTimer = setTimeout(() => {
					if (isMounted && shouldReconnect && wsUrl) connectWebSocket();
				}, 2000);
			}
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
			shouldReconnect = false;
			ws.onclose = null;
			ws.close();
			ws = null;
		}
	}

	function sendMessage(message: ClientMessage): void {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	function nextSequence(): { seq: number; tick: number } {
		inputSeq++;
		clientTick++;
		return { seq: inputSeq, tick: clientTick };
	}

	/**
	 * Single source of truth for movement input:
	 * inputState drives both renderer input and WS payload.
	 */
	function pushInputState(): void {
		renderer?.setInput(inputState);
		const { seq, tick } = nextSequence();
		sendMessage({ type: 'input', seq, tick, keys: { ...inputState } });
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
			pushInputState();
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
			pushInputState();
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

		// Canonical aim convention:
		// - 0 = up, +PI/2 = right, PI = down, -PI/2 = left
		// - dx: positive = right on screen
		// - dy: positive = down on screen
		aimAngle = Math.atan2(dx, -dy);

		const { seq } = nextSequence();
		sendMessage({ type: 'aim', seq, angle: aimAngle });
		renderer?.setAimAngle(aimAngle);
	}

	function handleMouseDown(_event: MouseEvent): void {
		const { seq } = nextSequence();
		sendMessage({ type: 'shoot_start', seq });
		renderer?.setMousePressed(true);
	}

	function handleMouseUp(_event: MouseEvent): void {
		const { seq } = nextSequence();
		sendMessage({ type: 'shoot_stop', seq });
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

	{#if debug}
		<div class="debug-overlay">
			<p>Connected: {connected}</p>
			{#if gameState}
				<p>Score: {gameState.score}</p>
				<p>Lives: {gameState.ship.lives}</p>
				<p>Wave: {gameState.wave}</p>
				<p>Status: {gameState.gameStatus}</p>
			{:else}
				<p>Status: no-state</p>
			{/if}
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
