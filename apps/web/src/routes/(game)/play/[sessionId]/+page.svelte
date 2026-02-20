<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';

	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHUD from '$lib/components/game/GameHUD.svelte';
	import GameOverlay from '$lib/components/game/GameOverlay.svelte';
	import { getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();
	const _sessionId = (page.params as Record<string, string>).sessionId;

	onMount(() => {
		if (gameStore.phase === 'idle') {
			if (gameStore.matchSessionId && gameStore.joinToken) {
				// Normal join flow (e.g. direct URL navigation with in-memory state)
				gameStore.joinGame();
			} else {
				// Page reload — attempt reconnection via saved session data
				gameStore.reconnectToGame().then(() => {
					// If reconnection failed (back to idle), redirect to lobby
					if (gameStore.phase === 'idle') {
						goto('/play');
					}
				});
			}
		} else if (gameStore.phase === 'matched') {
			if (gameStore.matchSessionId && gameStore.joinToken) {
				gameStore.joinGame();
			}
		}

		// Send ready signal once connected
		const unsubscribe = $effect.root(() => {
			$effect(() => {
				if (gameStore.phase === 'waiting') {
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
	<title>{m.game_title()} | ft_transcendence</title>
</svelte:head>

<div class="relative">
	<GameCanvas />
	<GameHUD />
	<GameOverlay />
</div>
