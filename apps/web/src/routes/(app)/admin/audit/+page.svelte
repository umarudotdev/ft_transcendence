<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime';
	import { createAuditLogQuery, type AuditLogEntry } from '$lib/queries/moderation';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let actionFilter = $state<string | undefined>(undefined);
	let currentPage = $state(0);
	const pageSize = 20;

	const auditLogQuery = $derived(
		createAuditLogQuery({
			limit: pageSize,
			offset: currentPage * pageSize,
			action: actionFilter || undefined
		})
	);

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function getActionColor(action: string): string {
		if (action.includes('deleted') || action.includes('revoked')) {
			return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/30';
		}
		if (action.includes('ban') || action.includes('sanction')) {
			return 'text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30';
		}
		if (action.includes('role') || action.includes('created')) {
			return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30';
		}
		if (action.includes('resolved') || action.includes('approved')) {
			return 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/30';
		}
		return 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800';
	}

	function formatAction(action: string): string {
		const match = actionOptions.find((o) => o.value === action);
		if (match) return match.label;
		return action
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function parseDetails(details: string | null): Record<string, unknown> | null {
		if (!details) return null;
		try {
			return JSON.parse(details);
		} catch {
			return null;
		}
	}

	const totalPages = $derived(Math.ceil((auditLogQuery.data?.total ?? 0) / pageSize));
	const canGoBack = $derived(currentPage > 0);
	const canGoNext = $derived(currentPage < totalPages - 1);

	const actionOptions = $derived([
		{ value: 'role_changed', label: m.admin_audit_role_changed() },
		{ value: 'user_deleted', label: m.admin_audit_user_deleted() },
		{ value: 'report_created', label: m.admin_audit_report_created() },
		{ value: 'report_resolved', label: m.admin_audit_report_resolved() },
		{ value: 'sanction_issued', label: m.admin_audit_sanction_issued() },
		{ value: 'sanction_revoked', label: m.admin_audit_sanction_revoked() }
	]);
</script>

<svelte:head>
	<title>{m.admin_audit_title()} | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m.admin_audit_title()}</h1>
		<p class="text-muted-foreground">{m.admin_audit_subtitle()}</p>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
			<Select.Root
				type="single"
				bind:value={actionFilter}
				onValueChange={() => {
					currentPage = 0;
				}}
			>
				<Select.Trigger class="w-full sm:w-48">
					{actionFilter ? formatAction(actionFilter) : m.admin_audit_all_actions()}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">{m.admin_audit_all_actions()}</Select.Item>
					{#each actionOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</Card.Content>
	</Card.Root>

	<!-- Audit Log Table -->
	<Card.Root>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[180px]">{m.admin_audit_date()}</Table.Head>
					<Table.Head>{m.admin_audit_actor()}</Table.Head>
					<Table.Head>{m.admin_audit_action()}</Table.Head>
					<Table.Head>{m.admin_audit_target()}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{m.admin_audit_details()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if auditLogQuery.isPending}
					{#each Array(5) as _}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-36" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-5 w-28" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-40" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if auditLogQuery.error}
					<Table.Row>
						<Table.Cell colspan={5} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_audit_failed()}</p>
						</Table.Cell>
					</Table.Row>
				{:else if auditLogQuery.data?.entries.length === 0}
					<Table.Row>
						<Table.Cell colspan={5} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_audit_no_entries()}</p>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each auditLogQuery.data?.entries ?? [] as entry}
						{@const details = parseDetails(entry.details)}
						<Table.Row>
							<Table.Cell class="text-sm text-muted-foreground">
								{formatDate(entry.createdAt)}
							</Table.Cell>
							<Table.Cell class="font-medium">{entry.actorName}</Table.Cell>
							<Table.Cell>
								<Badge class={getActionColor(entry.action)}>
									{formatAction(entry.action)}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if entry.targetUserName}
									{entry.targetUserName}
								{:else if entry.targetType && entry.targetId}
									{entry.targetType} #{entry.targetId}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="hidden lg:table-cell">
								{#if details}
									<div class="max-w-[300px] truncate text-sm text-muted-foreground">
										{#if details.reason}
											{m.admin_audit_reason_prefix({ reason: details.reason })}
										{:else if details.oldRole && details.newRole}
											{details.oldRole} → {details.newRole}
										{:else if details.email}
											{details.email}
										{:else}
											{JSON.stringify(details)}
										{/if}
									</div>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>

		<!-- Pagination -->
		{#if (auditLogQuery.data?.total ?? 0) > pageSize}
			<div class="flex items-center justify-between border-t px-4 py-3">
				<p class="text-sm text-muted-foreground">
					{m.common_showing_range({ start: currentPage * pageSize + 1, end: Math.min(
						(currentPage + 1) * pageSize,
						auditLogQuery.data?.total ?? 0
					), total: auditLogQuery.data?.total ?? 0 })}
				</p>
				<div class="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						disabled={!canGoBack}
						onclick={() => (currentPage -= 1)}
					>
						<ChevronLeftIcon class="size-4" />
						{m.common_previous()}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canGoNext}
						onclick={() => (currentPage += 1)}
					>
						{m.common_next()}
						<ChevronRightIcon class="size-4" />
					</Button>
				</div>
			</div>
		{/if}
	</Card.Root>
</div>
