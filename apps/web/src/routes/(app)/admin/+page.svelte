<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
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
			label: m.admin_total_users(),
			value: dashboardQuery.data?.totalUsers ?? 0,
			icon: UsersIcon,
			color: 'text-blue-600',
			bg: 'bg-blue-100 dark:bg-blue-900/30'
		},
		{
			label: m.admin_moderators(),
			value: dashboardQuery.data?.totalModerators ?? 0,
			icon: ShieldIcon,
			color: 'text-green-600',
			bg: 'bg-green-100 dark:bg-green-900/30'
		},
		{
			label: m.admin_admins(),
			value: dashboardQuery.data?.totalAdmins ?? 0,
			icon: ShieldAlertIcon,
			color: 'text-purple-600',
			bg: 'bg-purple-100 dark:bg-purple-900/30'
		},
		{
			label: m.admin_pending_reports(),
			value: dashboardQuery.data?.pendingReports ?? 0,
			icon: FlagIcon,
			color: 'text-yellow-600',
			bg: 'bg-yellow-100 dark:bg-yellow-900/30'
		},
		{
			label: m.admin_active_sanctions(),
			value: dashboardQuery.data?.activeSanctions ?? 0,
			icon: GavelIcon,
			color: 'text-red-600',
			bg: 'bg-red-100 dark:bg-red-900/30'
		},
		{
			label: m.admin_recent_activity(),
			value: dashboardQuery.data?.recentAuditLogs ?? 0,
			icon: ActivityIcon,
			color: 'text-slate-600',
			bg: 'bg-slate-100 dark:bg-slate-900/30',
			subtitle: m.admin_last_24h()
		}
	]);
</script>

<svelte:head>
	<title>{m.admin_dashboard_title()} | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m.admin_dashboard_title()}</h1>
		<p class="text-muted-foreground">{m.admin_dashboard_subtitle()}</p>
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
						{m.admin_failed_dashboard()}
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
				<Card.Title>{m.admin_quick_actions()}</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2">
				<a
					href="/admin/users"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
				>
					<UsersIcon class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">{m.admin_manage_users()}</p>
						<p class="text-sm text-muted-foreground">{m.admin_manage_users_description()}</p>
					</div>
				</a>
				<a
					href="/admin/reports"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
				>
					<FlagIcon class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">{m.admin_review_reports()}</p>
						<p class="text-sm text-muted-foreground">{m.admin_review_reports_description()}</p>
					</div>
				</a>
				<a
					href="/admin/sanctions"
					class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
				>
					<GavelIcon class="size-5 text-muted-foreground" />
					<div>
						<p class="font-medium">{m.admin_manage_sanctions()}</p>
						<p class="text-sm text-muted-foreground">{m.admin_manage_sanctions_description()}</p>
					</div>
				</a>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.admin_platform_health()}</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">{m.admin_resolution_rate()}</span>
					<span class="font-medium">
						{#if dashboardQuery.data}
							{dashboardQuery.data.pendingReports === 0 ? '100%' : 'N/A'}
						{:else}
							--
						{/if}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">{m.admin_active_sanctions()}</span>
					<span class="font-medium">
						{dashboardQuery.data?.activeSanctions ?? '--'}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-muted-foreground">{m.admin_admin_activity()}</span>
					<span class="font-medium">
						{dashboardQuery.data?.recentAuditLogs ?? '--'} {m.admin_actions_suffix()}
					</span>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
