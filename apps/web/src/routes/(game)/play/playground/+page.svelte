<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import GameCanvas from '$lib/components/game/GameCanvas.svelte';
	import GameHUD from '$lib/components/game/GameHUD.svelte';
	import PlaygroundOverlay from '$lib/components/game/PlaygroundOverlay.svelte';
	import { createMeQuery } from '$lib/queries/auth';
	import { getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();
	const meQuery = createMeQuery();

	onMount(() => {
		if (gameStore.phase === 'idle') {
			// Direct URL navigation or page reload — try to re-join
			const tryRejoin = async () => {
				const me = meQuery.data;
				if (!me) {
					// Wait for query to settle
					const unsubscribe = $effect.root(() => {
						$effect(() => {
							if (meQuery.data) {
								unsubscribe();
								rejoinWithUser(meQuery.data);
							} else if (!meQuery.isPending) {
								unsubscribe();
								goto('/play');
							}
						});
					});
					return;
				}
				await rejoinWithUser(me);
			};
			tryRejoin();
		}

		// Send ready signal once connected (PlaygroundRoom treats it as no-op but
		// server state sync will advance phase)
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

	async function rejoinWithUser(me: { id: number; displayName: string }) {
		await gameStore.joinPlayground(me.id, me.displayName);
		if (gameStore.phase === 'idle') {
			goto('/play');
		}
	}
</script>

<svelte:head>
	<title>Practice | ft_transcendence</title>
</svelte:head>

<div class="relative">
	<GameCanvas />
	<GameHUD />
	<PlaygroundOverlay />
</div>
