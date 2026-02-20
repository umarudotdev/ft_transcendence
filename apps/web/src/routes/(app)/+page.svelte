<script lang="ts">
	import GamepadIcon from '@lucide/svelte/icons/gamepad-2';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import { createMeQuery } from '$lib/queries/auth';
	import { createMyMatchesQuery, createMyStatsQuery } from '$lib/queries/users';

	const meQuery = createMeQuery();
	const statsQuery = createMyStatsQuery();
	const matchesQuery = createMyMatchesQuery({ limit: 5 });

	function formatWinRate(wins: number, total: number): string {
		if (total === 0) return '0%';
		return `${Math.round((wins / total) * 100)}%`;
	}
</script>

<svelte:head>
	<title>{m.dashboard_title()} | ft_transcendence</title>
</svelte:head>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.dashboard_title()}</h1>
			<p class="text-muted-foreground">{m.dashboard_subtitle()}</p>
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
					<h2 class="text-2xl font-bold">{m.dashboard_ready()}</h2>
					<p class="text-muted-foreground">{m.dashboard_ready_description()}</p>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button size="lg" class="gap-2" href="/play">
						<SwordsIcon class="size-5" />
						{m.dashboard_quick_match()}
					</Button>
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
					{m.dashboard_your_stats()}
				</Card.Title>
				<Card.Description>{m.dashboard_stats_description()}</Card.Description>
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
							<a href="/auth/login" class="text-primary underline">Sign in</a> {m.dashboard_sign_in_stats()}
						</p>
					</div>
				{:else if statsQuery.data}
					{@const stats = statsQuery.data}
					<div class="grid grid-cols-3 gap-4">
						<div class="space-y-1">
							<div class="flex items-center gap-1">
								<span class="text-2xl font-bold text-green-600">{stats.wins}</span>
							</div>
							<p class="text-sm text-muted-foreground">{m.dashboard_wins()}</p>
						</div>
						<div class="space-y-1">
							<div class="flex items-center gap-1">
								<span class="text-2xl font-bold text-red-600">{stats.losses}</span>
							</div>
							<p class="text-sm text-muted-foreground">{m.dashboard_losses()}</p>
						</div>
						<div class="space-y-1">
							<div class="flex items-center gap-1">
								<TrendingUpIcon class="size-4 text-primary" />
								<span class="text-2xl font-bold"
									>{formatWinRate(stats.wins, stats.wins + stats.losses)}</span
								>
							</div>
							<p class="text-sm text-muted-foreground">{m.dashboard_win_rate()}</p>
						</div>
					</div>
				{:else}
					<div class="py-8 text-center">
						<p class="text-muted-foreground">
							{m.dashboard_no_games()}
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
						{m.dashboard_recent_matches()}
					</Card.Title>
					<Card.Description>{m.dashboard_latest_games()}</Card.Description>
				</div>
				{#if matchesQuery.data && matchesQuery.data.matches.length > 0}
					<Button variant="ghost" size="sm" href="/profile">{m.common_view_all()}</Button>
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
							<a href="/auth/login" class="text-primary underline">Sign in</a> {m.dashboard_sign_in_matches()}
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
										{match.result === 'win' ? m.dashboard_win() : m.dashboard_loss()}
									</Badge>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center">
						<p class="text-muted-foreground">{m.dashboard_no_matches()}</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
