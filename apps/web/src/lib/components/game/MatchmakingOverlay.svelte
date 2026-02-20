<script lang="ts">
	import { goto } from '$app/navigation';
	import MatchFoundScreen from '$lib/components/game/MatchFoundScreen.svelte';
	import QueueScreen from '$lib/components/game/QueueScreen.svelte';
	import { getTierForRating } from '$lib/game/matchmaking-utils';
	import { m } from '$lib/paraglide/messages.js';
	import { createMeQuery } from '$lib/queries/auth';
	import { createMyRankingQuery } from '$lib/queries/rankings';
	import { type GamePhase, getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();
	const meQuery = createMeQuery();
	const rankingQuery = createMyRankingQuery();

	let phase: GamePhase = $derived(gameStore.phase);
	let queuePosition = $derived(gameStore.queuePosition);
	let estimatedWait = $derived(gameStore.estimatedWait);
	let opponent = $derived(gameStore.opponent);
	let matchSessionId = $derived(gameStore.matchSessionId);

	let elapsedSeconds = $state(0);
	let elapsedInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		if (phase === 'queuing') {
			elapsedSeconds = 0;
			elapsedInterval = setInterval(() => {
				elapsedSeconds++;
			}, 1000);
		} else {
			if (elapsedInterval) {
				clearInterval(elapsedInterval);
				elapsedInterval = null;
			}
		}
	});

	$effect(() => {
		if (phase === 'matched' && matchSessionId) {
			const sessionId = matchSessionId;
			const timeout = setTimeout(async () => {
				await gameStore.joinGame();
				// Only navigate if joinGame succeeded (not reset to idle)
				if (gameStore.phase !== 'idle') {
					goto(`/play/${sessionId}`);
				}
			}, 2000);

			return () => clearTimeout(timeout);
		}
	});

	function handleCancel() {
		gameStore.leaveQueue();
	}

	let playerName = $derived(meQuery.data?.displayName ?? m.game_player_fallback());
	let playerRating = $derived(rankingQuery.data?.rating ?? 1000);
	let playerTier = $derived(rankingQuery.data?.tier ?? getTierForRating(playerRating));
</script>

{#if phase === 'queuing'}
	<QueueScreen
		{elapsedSeconds}
		{queuePosition}
		{estimatedWait}
		mode={gameStore.queueMode}
		onCancel={handleCancel}
	/>
{:else if phase === 'matched' && opponent}
	<MatchFoundScreen {playerName} {playerRating} {playerTier} {opponent} />
{:else if phase === 'connecting'}
	<div class="flex flex-col items-center gap-4 py-16">
		<div class="size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></div>
		<p class="text-muted-foreground">{m.game_connecting()}</p>
	</div>
{/if}
