<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { createAdminDashboardQuery } from '$lib/queries/moderation';
	import UsersIcon from '@lucide/svelte/icons/users';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import FlagIcon from '@lucide/svelte/icons/flag';
	import GavelIcon from '@lucide/svelte/icons/gavel';
	import ActivityIcon from '@lucide/svelte/icons/activity';

	const dashboardQuery = createAdminDashboardQuery();

	const statCards = $derived([
		{
			label: 'Total Users',
			value: dashboardQuery.data?.totalUsers ?? 0,
			icon: UsersIcon,
			color: 'text-blue-600',
			bg: 'bg-blue-100 dark:bg-blue-900/30'
		},
		{
			label: 'Moderators',
			value: dashboardQuery.data?.totalModerators ?? 0,
			icon: ShieldIcon,
			color: 'text-green-600',
			bg: 'bg-green-100 dark:bg-green-900/30'
		},
		{
			label: 'Admins',
			value: dashboardQuery.data?.totalAdmins ?? 0,
			icon: ShieldAlertIcon,
			color: 'text-purple-600',
			bg: 'bg-purple-100 dark:bg-purple-900/30'
		},
		{
			label: 'Pending Reports',
			value: dashboardQuery.data?.pendingReports ?? 0,
			icon: FlagIcon,
			color: 'text-yellow-600',
			bg: 'bg-yellow-100 dark:bg-yellow-900/30'
		},
		{
			label: 'Active Sanctions',
			value: dashboardQuery.data?.activeSanctions ?? 0,
			icon: GavelIcon,
			color: 'text-red-600',
			bg: 'bg-red-100 dark:bg-red-900/30'
		},
		{
			label: 'Recent Activity',
			value: dashboardQuery.data?.recentAuditLogs ?? 0,
			icon: ActivityIcon,
			color: 'text-slate-600',
			bg: 'bg-slate-100 dark:bg-slate-900/30',
			subtitle: 'Last 24h'
		}
	]);
</script>

<svelte:head>
	<title>Admin Dashboard | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
		<p class="text-muted-foreground">Overview of platform statistics and activity</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#if dashboardQuery.isPending}
			{#each Array(6) as _}
				<Card.Root>
					<Card.Content class="p-6">
						<div class="flex items-center gap-4">
							<Skeleton class="size-12 rounded-lg" />
							<div class="space-y-2">
								<Skeleton class="h-4 w-20" />
								<Skeleton class="h-7 w-12" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		{:else if dashboardQuery.error}
			<Card.Root class="col-span-full">
				<Card.Content class="p-6 text-center">
					<p class="text-muted-foreground">
						Failed to load dashboard stats. Please try again later.
					</p>
				</Card.Content>
			</Card.Root>
		{:else}
			{#each statCards as card}
				<Card.Root>
					<Card.Content class="p-6">
						<div class="flex items-center gap-4">
							<div class="flex size-12 items-center justify-center rounded-lg {card.bg}">
								<card.icon class="size-6 {card.color}" />
							</div>
							<div>
								<p class="text-sm text-muted-foreground">{card.label}</p>
								<p class="text-2xl font-bold">{card.value.toLocaleString()}</p>
								{#if card.subtitle}
									<p class="text-xs text-muted-foreground">{card.subtitle}</p>
								{/if}
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Quick Actions</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2">
				<a
					href="/admin/users"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
				>
					<UsersIcon class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">Manage Users</p>
						<p class="text-sm text-muted-foreground">View, edit roles, or delete users</p>
					</div>
				</a>
				<a
					href="/admin/reports"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
				>
					<FlagIcon class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">Review Reports</p>
						<p class="text-sm text-muted-foreground">Handle pending user reports</p>
					</div>
				</a>
				<a
					href="/admin/sanctions"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
				>
					<GavelIcon class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">Manage Sanctions</p>
						<p class="text-sm text-muted-foreground">View and revoke user sanctions</p>
					</div>
				</a>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Platform Health</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Report Resolution Rate</span>
					<span class="font-medium">
						{#if dashboardQuery.data}
							{dashboardQuery.data.pendingReports === 0 ? '100%' : 'N/A'}
						{:else}
							--
						{/if}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Active Sanctions</span>
					<span class="font-medium">
						{dashboardQuery.data?.activeSanctions ?? '--'}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Admin Activity (24h)</span>
					<span class="font-medium">
						{dashboardQuery.data?.recentAuditLogs ?? '--'} actions
					</span>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
