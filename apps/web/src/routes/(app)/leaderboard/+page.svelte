<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { RankBadge } from '$lib/components/rankings';
	import {
		createLeaderboardQuery,
		createMyRankingQuery,
		type LeaderboardEntry,
		type PlayerTier
	} from '$lib/queries/rankings';
	import { getInitials } from '$lib/utils';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let offset = $state(0);
	const limit = 20;

	const leaderboardQuery = $derived(createLeaderboardQuery({ limit, offset }));
	const myRankingQuery = createMyRankingQuery();

	function getRankDisplay(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

	function handlePrevPage() {
		offset = Math.max(0, offset - limit);
	}

	function handleNextPage() {
		if (leaderboardQuery.data?.hasMore) {
			offset += limit;
		}
	}

	function handleRowClick(userId: number) {
		goto(`/users/${userId}`);
	}
</script>

<svelte:head>
	<title>Leaderboard | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Leaderboard</h1>
			<p class="text-muted-foreground">Top players ranked by Elo rating</p>
		</div>
	</div>

	{#if myRankingQuery.data}
		{@const ranking = myRankingQuery.data}
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-lg">Your Ranking</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<span class="text-2xl font-bold">{getRankDisplay(ranking.rank)}</span>
						<div>
							<RankBadge tier={ranking.tier as PlayerTier} rating={ranking.rating} showRating />
						</div>
					</div>
					<div class="text-right text-sm text-muted-foreground">
						<div>{ranking.gamesRated} rated games</div>
						<div>Peak: {ranking.peakRating}</div>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}

	<Card>
		<CardHeader class="flex flex-row items-center justify-between pb-2">
			<CardTitle class="flex items-center gap-2">
				<TrophyIcon class="size-5" />
				Global Rankings
			</CardTitle>
			{#if leaderboardQuery.data}
				<span class="text-sm text-muted-foreground">
					{leaderboardQuery.data.total} players
				</span>
			{/if}
		</CardHeader>
		<CardContent>
			{#if leaderboardQuery.isPending}
				<div class="space-y-3">
					{#each Array(10) as _}
						<Skeleton class="h-12 w-full" />
					{/each}
				</div>
			{:else if leaderboardQuery.data?.entries.length === 0}
				<div class="py-12 text-center">
					<TrophyIcon class="mx-auto mb-4 size-12 text-muted-foreground" />
					<p class="text-muted-foreground">No rankings yet</p>
					<p class="text-sm text-muted-foreground">
						Play some matches to appear on the leaderboard!
					</p>
				</div>
			{:else if leaderboardQuery.data}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead class="w-16">Rank</TableHead>
							<TableHead>Player</TableHead>
							<TableHead class="text-center">Tier</TableHead>
							<TableHead class="text-right">Rating</TableHead>
							<TableHead class="text-right">Games</TableHead>
							<TableHead class="text-right">Peak</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each leaderboardQuery.data.entries as entry}
							<TableRow
								class="cursor-pointer hover:bg-muted/50"
								onclick={() => handleRowClick(entry.userId)}
							>
								<TableCell class="font-medium">
									{getRankDisplay(entry.rank)}
								</TableCell>
								<TableCell>
									<div class="flex items-center gap-3">
										<Avatar class="size-8">
											{#if entry.avatarUrl}
												<AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
											{/if}
											<AvatarFallback class="text-xs">
												{getInitials(entry.displayName)}
											</AvatarFallback>
										</Avatar>
										<span class="font-medium">{entry.displayName}</span>
									</div>
								</TableCell>
								<TableCell class="text-center">
									<RankBadge tier={entry.tier as PlayerTier} size="sm" />
								</TableCell>
								<TableCell class="text-right font-mono">
									{entry.rating}
								</TableCell>
								<TableCell class="text-right text-muted-foreground">
									{entry.gamesRated}
								</TableCell>
								<TableCell class="text-right text-muted-foreground">
									{entry.peakRating}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>

				<div class="mt-4 flex items-center justify-between">
					<div class="text-sm text-muted-foreground">
						Showing {offset + 1}-{Math.min(offset + limit, leaderboardQuery.data.total)} of {leaderboardQuery
							.data.total}
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={handlePrevPage} disabled={offset === 0}>
							<ChevronLeftIcon class="mr-1 size-4" />
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={handleNextPage}
							disabled={!leaderboardQuery.data.hasMore}
						>
							Next
							<ChevronRightIcon class="ml-1 size-4" />
						</Button>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
