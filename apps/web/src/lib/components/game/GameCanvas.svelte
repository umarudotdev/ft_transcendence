<script lang="ts">
import { onMount } from "svelte";

import { createInputHandler } from "$lib/game/input";
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	type GameRenderState,
	renderFrame,
} from "$lib/game/renderer";
import { getGameStore } from "$lib/stores/game.svelte";

const gameStore = getGameStore();

// oxlint-disable-next-line no-unassigned-vars -- assigned via bind:this
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null = null;
let animationId: number;

const inputHandler = createInputHandler(
	(input) => gameStore.sendInput(input),
	(slot) => gameStore.sendAbility(slot),
);

function gameLoop() {
	if (!ctx) return;

	const state: GameRenderState = {
		players: gameStore.players,
		bullets: gameStore.bullets,
		effects: gameStore.effects,
		tick: gameStore.gameTick,
		phase: gameStore.phase,
		countdownTimer: gameStore.countdownTimer,
		mySessionId: gameStore.mySessionId ?? "",
	};

	renderFrame(ctx, state);

	animationId = requestAnimationFrame(gameLoop);
}

onMount(() => {
	ctx = canvas.getContext("2d");

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
