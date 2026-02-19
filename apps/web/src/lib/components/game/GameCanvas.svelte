<script lang="ts">
	import { onMount } from 'svelte';

	import { createInputHandler } from '$lib/game/input';
	import { createParticleSystem } from '$lib/game/particles';
	import {
		CANVAS_HEIGHT,
		CANVAS_WIDTH,
		type GameRenderState,
		renderFrame
	} from '$lib/game/renderer';
	import { getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();

	// oxlint-disable-next-line no-unassigned-vars -- assigned via bind:this
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let animationId: number;
	let lastTime = 0;

	const particles = createParticleSystem();

	// Track previous state for particle emission triggers
	let prevEffectCount = 0;
	let prevPlayerHps = new Map<string, number>();
	let prevDashStates = new Map<string, boolean>();

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
			}
			prevDashStates.set(sessionId, player.isDashing);
		}
	}

	function gameLoop(time: number) {
		if (!ctx) return;

		const dt = lastTime > 0 ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
		lastTime = time;

		const state: GameRenderState = {
			players: gameStore.players,
			bullets: gameStore.bullets,
			effects: gameStore.effects,
			tick: gameStore.gameTick,
			phase: gameStore.phase,
			countdownTimer: gameStore.countdownTimer,
			mySessionId: gameStore.mySessionId ?? ''
		};

		emitParticlesFromStateChanges(state);
		renderFrame(ctx, state, particles, dt);

		animationId = requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		ctx = canvas.getContext('2d');

		const inputHandler = createInputHandler(
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
			inputHandler.detach();
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
