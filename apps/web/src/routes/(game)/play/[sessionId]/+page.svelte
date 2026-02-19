<script lang="ts">
import { onMount } from "svelte";
import { page } from "$app/state";

import GameCanvas from "$lib/components/game/GameCanvas.svelte";
import GameHUD from "$lib/components/game/GameHUD.svelte";
import GameOverlay from "$lib/components/game/GameOverlay.svelte";
import { getGameStore } from "$lib/stores/game.svelte";

const gameStore = getGameStore();
const _sessionId = (page.params as Record<string, string>).sessionId;

onMount(() => {
	// If we're not already connected (e.g. direct URL navigation), try to join
	if (gameStore.phase === "idle" || gameStore.phase === "matched") {
		if (gameStore.matchSessionId && gameStore.joinToken) {
			gameStore.joinGame();
		}
	}

	// Send ready signal once connected
	const unsubscribe = $effect.root(() => {
		$effect(() => {
			if (gameStore.phase === "waiting") {
				gameStore.sendReady();
			}
		});
	});

	return () => {
		unsubscribe();
		gameStore.disconnect();
	};
});
</script>

<svelte:head>
	<title>Game | ft_transcendence</title>
</svelte:head>

<div class="relative">
	<GameCanvas />
	<GameHUD />
	<GameOverlay />
</div>
