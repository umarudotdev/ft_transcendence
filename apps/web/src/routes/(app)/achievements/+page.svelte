<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import {
		AchievementCard,
		PointsDisplay,
		StreakCounter,
		DailyReward
	} from '$lib/components/gamification';
	import {
		createAchievementsQuery,
		createMyAchievementsQuery,
		createPointsQuery,
		createStreakQuery,
		getCategoryName,
		type Achievement
	} from '$lib/queries/gamification';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import { m } from '$lib/paraglide/messages.js';

	const achievementsQuery = createAchievementsQuery();
	const myAchievementsQuery = createMyAchievementsQuery();
	const pointsQuery = createPointsQuery();
	const streakQuery = createStreakQuery();

	// Group achievements by category
	const groupedAchievements = $derived(() => {
		if (!achievementsQuery.data) return {};

		return achievementsQuery.data.reduce(
			(acc, achievement) => {
				const category = achievement.category;
				if (!acc[category]) {
					acc[category] = [];
				}
				acc[category].push(achievement);
				return acc;
			},
			{} as Record<string, Achievement[]>
		);
	});

	// Set of unlocked achievement IDs
	const unlockedIds = $derived(
		new Set(myAchievementsQuery.data?.map((ua) => ua.achievementId) ?? [])
	);

	// Get unlock date for an achievement
	function getUnlockDate(achievementId: number): Date | undefined {
		return myAchievementsQuery.data?.find((ua) => ua.achievementId === achievementId)?.unlockedAt;
	}

	// Stats
	const totalAchievements = $derived(achievementsQuery.data?.length ?? 0);
	const unlockedCount = $derived(myAchievementsQuery.data?.length ?? 0);
	const completionRate = $derived(
		totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0
	);
</script>

<svelte:head>
	<title>{m.achievements_title()} | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">{m.achievements_title()}</h1>
			<p class="text-muted-foreground">{m.achievements_subtitle()}</p>
		</div>
		<DailyReward />
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium text-muted-foreground">{m.achievements_points_balance()}</CardTitle>
			</CardHeader>
			<CardContent>
				{#if pointsQuery.isPending}
					<Skeleton class="h-8 w-24" />
				{:else if pointsQuery.data}
					<PointsDisplay balance={pointsQuery.data.balance} size="lg" />
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium text-muted-foreground">{m.achievements_login_streak()}</CardTitle>
			</CardHeader>
			<CardContent>
				{#if streakQuery.isPending}
					<Skeleton class="h-8 w-24" />
				{:else if streakQuery.data}
					<StreakCounter
						currentStreak={streakQuery.data.currentStreak}
						longestStreak={streakQuery.data.longestStreak}
						size="lg"
						showLongest
					/>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium text-muted-foreground">{m.achievements_title()}</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold">{unlockedCount}</span>
					<span class="text-muted-foreground">/ {totalAchievements}</span>
					<span class="text-sm text-muted-foreground">
						({completionRate.toFixed(0)}%)
					</span>
				</div>
			</CardContent>
		</Card>
	</div>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<TrophyIcon class="size-5" />
				{m.achievements_all()}
			</CardTitle>
		</CardHeader>
		<CardContent>
			{#if achievementsQuery.isPending || myAchievementsQuery.isPending}
				<div class="grid gap-4 md:grid-cols-2">
					{#each Array(6) as _}
						<Skeleton class="h-24 w-full" />
					{/each}
				</div>
			{:else if achievementsQuery.data?.length === 0}
				<div class="py-12 text-center">
					<TrophyIcon class="mx-auto mb-4 size-12 text-muted-foreground" />
					<p class="text-muted-foreground">{m.achievements_none()}</p>
				</div>
			{:else}
				{@const categories = Object.keys(groupedAchievements())}
				<Tabs value={categories[0] ?? ''}>
					<TabsList class="mb-4">
						{#each categories as category}
							<TabsTrigger value={category}>
								{getCategoryName(category)}
							</TabsTrigger>
						{/each}
					</TabsList>

					{#each categories as category}
						<TabsContent value={category}>
							<div class="grid gap-4 md:grid-cols-2">
								{#each groupedAchievements()[category] ?? [] as achievement}
									<AchievementCard
										{achievement}
										unlocked={unlockedIds.has(achievement.id)}
										unlockedAt={getUnlockDate(achievement.id)}
									/>
								{/each}
							</div>
						</TabsContent>
					{/each}
				</Tabs>
			{/if}
		</CardContent>
	</Card>
</div>
