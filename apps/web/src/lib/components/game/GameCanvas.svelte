<script lang="ts">
	import { onMount } from 'svelte';

	import { createInputHandler } from '$lib/game/input';
	import { createParticleSystem } from '$lib/game/particles';
	import {
		CANVAS_HEIGHT,
		CANVAS_WIDTH,
		type GameRenderState,
		renderFrame,
		startDashTrail
	} from '$lib/game/renderer';
	import { getDebugStore } from '$lib/stores/debug.svelte';
	import { getGameStore } from '$lib/stores/game.svelte';

	const MAX_ROTATION_SPEED = 8;
	const FPS_BUFFER_SIZE = 60;

	const gameStore = getGameStore();
	const debugStore = getDebugStore();

	// oxlint-disable-next-line no-unassigned-vars -- assigned via bind:this
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let animationId: number;
	let lastTime = 0;

	const particles = createParticleSystem();

	// Rolling FPS buffer
	const fpsBuffer: number[] = [];
	let fpsBufferIndex = 0;

	// Lifted to component scope for access in gameLoop
	let inputHandler: ReturnType<typeof createInputHandler> | null = null;
	let predictedAimAngle = 0;

	// Track previous state for particle emission triggers
	let prevEffectCount = 0;
	let prevPlayerHps = new Map<string, number>();
	let prevDashStates = new Map<string, boolean>();
	let prevPlayerPositions = new Map<string, { x: number; y: number; aimAngle: number }>();

	function emitParticlesFromStateChanges(state: GameRenderState) {
		// Detect new effects (bomb/ultimate)
		if (state.effects.length > prevEffectCount) {
			for (let i = prevEffectCount; i < state.effects.length; i++) {
				const effect = state.effects[i];
				if (effect.effectType === 'bomb') {
					particles.emitBomb(effect.x, effect.y);
				} else if (effect.effectType === 'ultimate') {
					particles.emitUltimate(effect.x, effect.y);
				}
			}
		}
		prevEffectCount = state.effects.length;

		// Detect hits (HP decreases) and dashes
		for (const [sessionId, player] of state.players) {
			const prevHp = prevPlayerHps.get(sessionId);
			const isP1 = player.playerIndex === 0;
			const rgb = isP1 ? { r: 107, g: 181, b: 255 } : { r: 255, g: 107, b: 107 };

			if (prevHp != null && player.hp < prevHp) {
				particles.emitHit(player.x, player.y, rgb.r, rgb.g, rgb.b);
				if (player.hp <= 0) {
					particles.emitDeath(player.x, player.y, rgb.r, rgb.g, rgb.b);
				}
			}
			prevPlayerHps.set(sessionId, player.hp);

			const prevDash = prevDashStates.get(sessionId) ?? false;
			if (player.isDashing && !prevDash) {
				particles.emitDash(player.x, player.y, player.aimAngle, rgb.r, rgb.g, rgb.b);
				const prev = prevPlayerPositions.get(sessionId);
				if (prev) {
					startDashTrail(
						prev.x,
						prev.y,
						player.x,
						player.y,
						player.aimAngle,
						player.playerIndex
					);
				}
			}
			prevDashStates.set(sessionId, player.isDashing);

			prevPlayerPositions.set(sessionId, {
				x: player.x,
				y: player.y,
				aimAngle: player.aimAngle
			});
		}
	}

	function rotateToward(current: number, target: number, maxDelta: number): number {
		let diff = target - current;
		diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
		if (diff < -Math.PI) diff += 2 * Math.PI;
		if (Math.abs(diff) <= maxDelta) return target;
		return current + Math.sign(diff) * maxDelta;
	}

	function gameLoop(time: number) {
		if (!ctx) return;

		const dt = lastTime > 0 ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
		lastTime = time;

		// Client-side prediction of aim angle using same rotation cap as server
		if (inputHandler) {
			predictedAimAngle = rotateToward(
				predictedAimAngle,
				inputHandler.state.aimAngle,
				MAX_ROTATION_SPEED * dt
			);
		}

		const state: GameRenderState = {
			players: gameStore.players,
			bullets: gameStore.bullets,
			effects: gameStore.effects,
			tick: gameStore.gameTick,
			phase: gameStore.phase,
			countdownTimer: gameStore.countdownTimer,
			mySessionId: gameStore.mySessionId ?? '',
			interpolator: gameStore.interpolator,
			localAimAngle: predictedAimAngle,
			spellCardDeclarer: gameStore.spellCardDeclarer,
			spellCardEndsAtTick: gameStore.spellCardEndsAtTick
		};

		emitParticlesFromStateChanges(state);
		renderFrame(ctx, state, particles, dt);

		// Update debug stats (rolling FPS average)
		if (fpsBuffer.length < FPS_BUFFER_SIZE) {
			fpsBuffer.push(dt);
		} else {
			fpsBuffer[fpsBufferIndex] = dt;
		}
		fpsBufferIndex = (fpsBufferIndex + 1) % FPS_BUFFER_SIZE;

		let dtSum = 0;
		for (const t of fpsBuffer) dtSum += t;
		const avgFps = fpsBuffer.length / dtSum;

		debugStore.update({
			fps: avgFps,
			frameTime: dt * 1000,
			bulletCount: state.bullets.length,
			particleCount: particles.activeCount,
			effectCount: state.effects.length
		});

		animationId = requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		ctx = canvas.getContext('2d');

		inputHandler = createInputHandler(
			(input) => gameStore.sendInput(input),
			(slot) => gameStore.sendAbility(slot),
			canvas,
			() => {
				const player = gameStore.getMyPlayer();
				if (!player) return null;
				return { x: player.x, y: player.y };
			}
		);

		inputHandler.attach();
		animationId = requestAnimationFrame(gameLoop);

		return () => {
			inputHandler?.detach();
			cancelAnimationFrame(animationId);
		};
	});
</script>

<canvas
	bind:this={canvas}
	width={CANVAS_WIDTH}
	height={CANVAS_HEIGHT}
	class="rounded-lg border border-md3-outline/30 shadow-xl"
></canvas>
