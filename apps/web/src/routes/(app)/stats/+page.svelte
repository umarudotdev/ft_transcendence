<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Chart from '$lib/components/ui/chart';
	import { createDailyStatsQuery, createMyStatsQuery } from '$lib/queries/users';
	import { AreaChart, Axis, Svg, Tooltip } from 'layerchart';
	import { scaleTime, scaleLinear } from 'd3-scale';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import GamepadIcon from '@lucide/svelte/icons/gamepad-2';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';

	const statsQuery = createMyStatsQuery();
	const dailyStatsQuery = createDailyStatsQuery(30);

	const chartConfig = {
		hoursPlayed: {
			label: 'Hours Played',
			color: 'hsl(var(--chart-1))'
		},
		gamesPlayed: {
			label: 'Games Played',
			color: 'hsl(var(--chart-2))'
		}
	} satisfies Chart.ChartConfig;

	// Format hours to display
	function formatHours(hours: number): string {
		if (hours < 1) {
			const minutes = Math.round(hours * 60);
			return `${minutes}m`;
		}
		const h = Math.floor(hours);
		const m = Math.round((hours - h) * 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	// Transform daily data for chart
	const chartData = $derived(
		dailyStatsQuery.data?.daily.map((d) => ({
			date: new Date(d.date),
			hoursPlayed: d.hoursPlayed,
			gamesPlayed: d.gamesPlayed,
			wins: d.wins
		})) ?? []
	);
</script>

<svelte:head>
	<title>My Stats | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6">
	<div class="space-y-1">
		<h1 class="text-3xl font-bold">My Statistics</h1>
		<p class="text-muted-foreground">Track your gaming progress over time</p>
	</div>

	<!-- Summary Cards -->
	<div class="grid gap-4 md:grid-cols-4">
		{#if dailyStatsQuery.isPending}
			{#each Array(4) as _}
				<Card>
					<CardContent class="p-6">
						<Skeleton class="mb-2 h-4 w-20" />
						<Skeleton class="h-8 w-16" />
					</CardContent>
				</Card>
			{/each}
		{:else}
			<Card>
				<CardContent class="p-6">
					<div class="flex items-center gap-2">
						<ClockIcon class="size-4 text-muted-foreground" />
						<span class="text-sm font-medium text-muted-foreground">Total Hours</span>
					</div>
					<p class="mt-2 text-3xl font-bold">
						{formatHours(dailyStatsQuery.data?.totals.totalHoursPlayed ?? 0)}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="p-6">
					<div class="flex items-center gap-2">
						<GamepadIcon class="size-4 text-muted-foreground" />
						<span class="text-sm font-medium text-muted-foreground">Total Games</span>
					</div>
					<p class="mt-2 text-3xl font-bold">
						{dailyStatsQuery.data?.totals.totalGamesPlayed ?? 0}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="p-6">
					<div class="flex items-center gap-2">
						<TrophyIcon class="size-4 text-muted-foreground" />
						<span class="text-sm font-medium text-muted-foreground">Total Wins</span>
					</div>
					<p class="mt-2 text-3xl font-bold">
						{statsQuery.data?.wins ?? 0}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardContent class="p-6">
					<div class="flex items-center gap-2">
						<TrendingUpIcon class="size-4 text-muted-foreground" />
						<span class="text-sm font-medium text-muted-foreground">Win Rate</span>
					</div>
					<p class="mt-2 text-3xl font-bold">
						{statsQuery.data?.winRate.toFixed(1) ?? 0}%
					</p>
				</CardContent>
			</Card>
		{/if}
	</div>

	<!-- Charts -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Hours Played Chart -->
		<Card>
			<CardHeader>
				<CardTitle>Hours Played (Last 30 Days)</CardTitle>
			</CardHeader>
			<CardContent>
				{#if dailyStatsQuery.isPending}
					<Skeleton class="h-[300px] w-full" />
				{:else if chartData.length === 0}
					<div class="flex h-[300px] items-center justify-center text-muted-foreground">
						No data available yet. Start playing!
					</div>
				{:else}
					<Chart.Container config={chartConfig} class="h-[300px] w-full">
						<AreaChart
							data={chartData}
							x="date"
							xScale={scaleTime()}
							y="hoursPlayed"
							yScale={scaleLinear()}
							yNice
							props={{
								area: {
									fill: 'hsl(var(--chart-1))',
									'fill-opacity': 0.3
								},
								line: {
									stroke: 'hsl(var(--chart-1))',
									'stroke-width': 2
								}
							}}
						>
							<Svg>
								<Axis
									placement="bottom"
									format={(d) =>
										d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
									tickCount={5}
								/>
								<Axis placement="left" format={(d) => `${d}h`} tickCount={5} />
							</Svg>
							<Tooltip.Root let:data>
								<Tooltip.Header>
									{data.date.toLocaleDateString('en-US', {
										weekday: 'short',
										month: 'short',
										day: 'numeric'
									})}
								</Tooltip.Header>
								<Tooltip.List>
									<Tooltip.Item label="Hours" value={formatHours(data.hoursPlayed)} />
								</Tooltip.List>
							</Tooltip.Root>
						</AreaChart>
					</Chart.Container>
				{/if}
			</CardContent>
		</Card>

		<!-- Games Played Chart -->
		<Card>
			<CardHeader>
				<CardTitle>Games Played (Last 30 Days)</CardTitle>
			</CardHeader>
			<CardContent>
				{#if dailyStatsQuery.isPending}
					<Skeleton class="h-[300px] w-full" />
				{:else if chartData.length === 0}
					<div class="flex h-[300px] items-center justify-center text-muted-foreground">
						No data available yet. Start playing!
					</div>
				{:else}
					<Chart.Container config={chartConfig} class="h-[300px] w-full">
						<AreaChart
							data={chartData}
							x="date"
							xScale={scaleTime()}
							y="gamesPlayed"
							yScale={scaleLinear()}
							yNice
							props={{
								area: {
									fill: 'hsl(var(--chart-2))',
									'fill-opacity': 0.3
								},
								line: {
									stroke: 'hsl(var(--chart-2))',
									'stroke-width': 2
								}
							}}
						>
							<Svg>
								<Axis
									placement="bottom"
									format={(d) =>
										d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
									tickCount={5}
								/>
								<Axis placement="left" tickCount={5} />
							</Svg>
							<Tooltip.Root let:data>
								<Tooltip.Header>
									{data.date.toLocaleDateString('en-US', {
										weekday: 'short',
										month: 'short',
										day: 'numeric'
									})}
								</Tooltip.Header>
								<Tooltip.List>
									<Tooltip.Item label="Games" value={data.gamesPlayed} />
									<Tooltip.Item label="Wins" value={data.wins} />
								</Tooltip.List>
							</Tooltip.Root>
						</AreaChart>
					</Chart.Container>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
