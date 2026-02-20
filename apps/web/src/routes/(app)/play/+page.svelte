<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import GamepadIcon from '@lucide/svelte/icons/gamepad-2';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import TargetIcon from '@lucide/svelte/icons/target';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import MatchmakingOverlay from '$lib/components/game/MatchmakingOverlay.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { createMeQuery } from '$lib/queries/auth';
	import { createMyMatchesQuery, createMyStatsQuery } from '$lib/queries/users';
	import { getGameStore } from '$lib/stores/game.svelte';

	const meQuery = createMeQuery();
	const statsQuery = createMyStatsQuery();
	const matchesQuery = createMyMatchesQuery({ limit: 5 });
	const gameStore = getGameStore();

	// Clean up stale state from previous game (e.g. browser back button while in "finished" phase)
	onMount(() => {
		gameStore.resetIfStale();
	});

	function handleQuickMatch() {
		gameStore.joinQueue('ranked');
	}

	function handleCasualMatch() {
		gameStore.joinQueue('casual');
	}

	async function handlePlayground() {
		const me = meQuery.data;
		if (!me) return;
		await gameStore.joinPlayground(me.id, me.displayName);
		if (gameStore.phase !== 'idle') {
			goto('/play/playground');
		}
	}

	function formatWinRate(wins: number, total: number): string {
		if (total === 0) return '0%';
		return `${Math.round((wins / total) * 100)}%`;
	}
</script>

<svelte:head>
	<title>Play | ft_transcendence</title>
</svelte:head>

{#if gameStore.phase === 'idle'}
	<div class="space-y-8">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Play</h1>
				<p class="text-muted-foreground">Challenge players or practice your skills</p>
			</div>
		</div>

		<!-- Quick Play Section -->
		<Card.Root class="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
			<Card.Content class="pt-6">
				<div class="flex flex-col items-center gap-6 py-8 text-center sm:flex-row sm:text-left">
					<div class="rounded-full bg-primary/10 p-6">
						<GamepadIcon class="size-12 text-primary" />
					</div>
					<div class="flex-1 space-y-2">
						<h2 class="text-2xl font-bold">Ready to Play?</h2>
						<p class="text-muted-foreground">
							Jump into a ranked match against another player or play a casual game.
						</p>
					</div>
					<div class="flex flex-col gap-2 sm:flex-row">
						<Button size="lg" class="gap-2" onclick={handleQuickMatch}>
							<SwordsIcon class="size-5" />
							Ranked Match
						</Button>
						<Button size="lg" variant="outline" class="gap-2" onclick={handleCasualMatch}>
							<GamepadIcon class="size-5" />
							Casual Match
						</Button>
						<Button
							size="lg"
							variant="secondary"
							class="gap-2"
							onclick={handlePlayground}
							disabled={!meQuery.data}
						>
							<TargetIcon class="size-5" />
							Practice
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Controls Info -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Controls</Card.Title>
				<Card.Description>Learn the controls before jumping in</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div class="space-y-1">
						<div class="font-medium">Movement</div>
						<div class="text-sm text-muted-foreground">WASD or Arrow Keys</div>
					</div>
					<div class="space-y-1">
						<div class="font-medium">Shoot</div>
						<div class="text-sm text-muted-foreground">Spacebar (auto-fire)</div>
					</div>
					<div class="space-y-1">
						<div class="font-medium">Focus Mode</div>
						<div class="text-sm text-muted-foreground">Shift (slower + precise shot)</div>
					</div>
					<div class="space-y-1">
						<div class="font-medium">Dash</div>
						<div class="text-sm text-muted-foreground">Q (8s cooldown)</div>
					</div>
					<div class="space-y-1">
						<div class="font-medium">Bomb</div>
						<div class="text-sm text-muted-foreground">E (clear bullets, 12s cooldown)</div>
					</div>
					<div class="space-y-1">
						<div class="font-medium">Ultimate</div>
						<div class="text-sm text-muted-foreground">R (charge by dealing damage)</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Stats Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<TrophyIcon class="size-5" />
						Your Stats
					</Card.Title>
					<Card.Description>Your performance overview</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if statsQuery.isPending || meQuery.isPending}
						<div class="grid grid-cols-3 gap-4">
							{#each Array(3) as _}
								<div class="space-y-2">
									<Skeleton class="h-8 w-16" />
									<Skeleton class="h-4 w-12" />
								</div>
							{/each}
						</div>
					{:else if !meQuery.data}
						<div class="py-8 text-center">
							<p class="text-muted-foreground">
								<a href="/auth/login" class="text-primary underline">Sign in</a>
								to track your stats
							</p>
						</div>
					{:else if statsQuery.data}
						{@const stats = statsQuery.data}
						<div class="grid grid-cols-3 gap-4">
							<div class="space-y-1">
								<span class="text-2xl font-bold text-green-600">{stats.wins}</span>
								<p class="text-sm text-muted-foreground">Wins</p>
							</div>
							<div class="space-y-1">
								<span class="text-2xl font-bold text-red-600">{stats.losses}</span>
								<p class="text-sm text-muted-foreground">Losses</p>
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-1">
									<TrendingUpIcon class="size-4 text-primary" />
									<span class="text-2xl font-bold"
										>{formatWinRate(stats.wins, stats.wins + stats.losses)}</span
									>
								</div>
								<p class="text-sm text-muted-foreground">Win Rate</p>
							</div>
						</div>
					{:else}
						<div class="py-8 text-center">
							<p class="text-muted-foreground">
								No games played yet. Start playing to track your stats!
							</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Recent Matches Card -->
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<div>
						<Card.Title class="flex items-center gap-2">
							<SwordsIcon class="size-5" />
							Recent Matches
						</Card.Title>
						<Card.Description>Your latest games</Card.Description>
					</div>
					{#if matchesQuery.data && matchesQuery.data.matches.length > 0}
						<Button variant="ghost" size="sm" href="/profile">View All</Button>
					{/if}
				</Card.Header>
				<Card.Content>
					{#if matchesQuery.isPending || meQuery.isPending}
						<div class="space-y-3">
							{#each Array(3) as _}
								<Skeleton class="h-14 w-full" />
							{/each}
						</div>
					{:else if !meQuery.data}
						<div class="py-8 text-center">
							<p class="text-muted-foreground">
								<a href="/auth/login" class="text-primary underline">Sign in</a>
								to see your matches
							</p>
						</div>
					{:else if matchesQuery.data && matchesQuery.data.matches.length > 0}
						<div class="space-y-2">
							{#each matchesQuery.data.matches as match}
								<div class="flex items-center justify-between rounded-lg border p-3">
									<div class="flex items-center gap-3">
										<span class="font-medium">{match.opponent.displayName}</span>
									</div>
									<div class="flex items-center gap-3">
										<span class="font-mono text-sm">
											{match.playerScore} - {match.opponentScore}
										</span>
										<Badge
											variant={match.result === 'win' ? 'default' : 'secondary'}
											class={match.result === 'win'
												? 'bg-green-600 hover:bg-green-600'
												: 'bg-red-600 text-white hover:bg-red-600'}
										>
											{match.result === 'win' ? 'Win' : 'Loss'}
										</Badge>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="py-8 text-center">
							<p class="text-muted-foreground">No matches yet. Play your first game!</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
{:else}
	<MatchmakingOverlay />
{/if}
