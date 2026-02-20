<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime';
	import {
		createReportsQuery,
		createResolveReportMutation,
		getReasonText,
		getStatusText,
		getStatusColor,
		type Report,
		type ReportStatus,
		type Resolution
	} from '$lib/queries/moderation';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	const resolveReportMutation = createResolveReportMutation();

	let statusFilter = $state<string | undefined>(undefined);
	let currentPage = $state(0);
	const pageSize = 20;

	const reportsQuery = $derived(
		createReportsQuery({
			limit: pageSize,
			offset: currentPage * pageSize,
			status: statusFilter ? (statusFilter as ReportStatus) : undefined
		})
	);

	// Dialog state
	let resolveDialogOpen = $state(false);
	let selectedReport = $state<Report | null>(null);
	let resolution = $state<string>('no_action');
	let sanctionDuration = $state('');
	let notes = $state('');

	function openResolveDialog(report: Report) {
		selectedReport = report;
		resolution = 'no_action';
		sanctionDuration = '';
		notes = '';
		resolveDialogOpen = true;
	}

	async function handleResolve() {
		if (!selectedReport) return;

		const durationHours = sanctionDuration ? parseInt(sanctionDuration, 10) : undefined;

		resolveReportMutation.mutate(
			{
				reportId: selectedReport.id,
				data: {
					resolution: resolution as Resolution,
					sanctionDuration: durationHours,
					notes: notes || undefined
				}
			},
			{
				onSuccess: () => {
					resolveDialogOpen = false;
					selectedReport = null;
				}
			}
		);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const totalPages = $derived(Math.ceil((reportsQuery.data?.total ?? 0) / pageSize));
	const canGoBack = $derived(currentPage > 0);
	const canGoNext = $derived(currentPage < totalPages - 1);

	const statusOptions = $derived([
		{ value: 'pending' as ReportStatus, label: m.admin_reports_status_pending() },
		{ value: 'reviewed' as ReportStatus, label: m.admin_reports_status_reviewed() },
		{ value: 'resolved' as ReportStatus, label: m.admin_reports_status_resolved() },
		{ value: 'dismissed' as ReportStatus, label: m.admin_reports_status_dismissed() }
	]);

	const resolutionOptions = $derived([
		{ value: 'no_action' as Resolution, label: m.admin_reports_resolution_no_action(), description: m.admin_reports_resolution_no_action_desc() },
		{ value: 'warning' as Resolution, label: m.admin_reports_resolution_warning(), description: m.admin_reports_resolution_warning_desc() },
		{ value: 'timeout' as Resolution, label: m.admin_reports_resolution_timeout(), description: m.admin_reports_resolution_timeout_desc() },
		{ value: 'ban' as Resolution, label: m.admin_reports_resolution_ban(), description: m.admin_reports_resolution_ban_desc() }
	]);

	const needsDuration = $derived((resolution as Resolution) === 'timeout');
</script>

<svelte:head>
	<title>{m.admin_reports_title()} | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m.admin_reports_title()}</h1>
		<p class="text-muted-foreground">{m.admin_reports_subtitle()}</p>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
			<Select.Root
				type="single"
				bind:value={statusFilter}
				onValueChange={() => {
					currentPage = 0;
				}}
			>
				<Select.Trigger class="w-full sm:w-40">
					{statusFilter ? getStatusText(statusFilter as ReportStatus) : m.admin_reports_all_statuses()}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">{m.admin_reports_all_statuses()}</Select.Item>
					{#each statusOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</Card.Content>
	</Card.Root>

	<!-- Reports Table -->
	<Card.Root>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.admin_reports_reporter()}</Table.Head>
					<Table.Head>{m.admin_reports_reported_user()}</Table.Head>
					<Table.Head>{m.admin_reports_reason()}</Table.Head>
					<Table.Head>{m.admin_reports_status()}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{m.admin_reports_date()}</Table.Head>
					<Table.Head class="text-right">{m.admin_reports_actions()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if reportsQuery.isPending}
					{#each Array(5) as _}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-5 w-20" /></Table.Cell>
							<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
							<Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell><Skeleton class="ml-auto h-8 w-20" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if reportsQuery.error}
					<Table.Row>
						<Table.Cell colspan={6} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_reports_failed()}</p>
						</Table.Cell>
					</Table.Row>
				{:else if reportsQuery.data?.reports.length === 0}
					<Table.Row>
						<Table.Cell colspan={6} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_reports_no_reports()}</p>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each reportsQuery.data?.reports ?? [] as report}
						<Table.Row>
							<Table.Cell class="font-medium">{report.reporterName}</Table.Cell>
							<Table.Cell>{report.reportedUserName}</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{getReasonText(report.reason)}</Badge>
							</Table.Cell>
							<Table.Cell>
								<Badge class={getStatusColor(report.status)}>
									{getStatusText(report.status)}
								</Badge>
							</Table.Cell>
							<Table.Cell class="hidden lg:table-cell">
								{formatDate(report.createdAt)}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if report.status === 'pending'}
									<Button size="sm" onclick={() => openResolveDialog(report)}>{m.admin_reports_resolve()}</Button>
								{:else}
									<span class="text-sm text-muted-foreground">
										{report.resolution ?? m.admin_reports_no_action()}
									</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>

		<!-- Pagination -->
		{#if (reportsQuery.data?.total ?? 0) > pageSize}
			<div class="flex items-center justify-between border-t px-4 py-3">
				<p class="text-sm text-muted-foreground">
					{m.common_showing_range({ start: currentPage * pageSize + 1, end: Math.min(
						(currentPage + 1) * pageSize,
						reportsQuery.data?.total ?? 0
					), total: reportsQuery.data?.total ?? 0 })}
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

<!-- Resolve Report Dialog -->
<Dialog.Root bind:open={resolveDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.admin_reports_resolve_title()}</Dialog.Title>
			<Dialog.Description>
				{#if selectedReport}
					{m.admin_reports_resolve_description({ name: selectedReport.reportedUserName, reason: getReasonText(
						selectedReport.reason
					) })}
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			{#if selectedReport?.description}
				<div class="space-y-2">
					<Label>{m.admin_reports_description_label()}</Label>
					<p class="rounded-md border p-3 text-sm text-muted-foreground">
						{selectedReport.description}
					</p>
				</div>
			{/if}

			<div class="space-y-2">
				<Label>{m.admin_reports_resolution()}</Label>
				<Select.Root type="single" bind:value={resolution}>
					<Select.Trigger>
						{resolutionOptions.find((o) => o.value === resolution)?.label ?? m.admin_reports_select_resolution()}
					</Select.Trigger>
					<Select.Content>
						{#each resolutionOptions as option}
							<Select.Item value={option.value}>
								<div>
									<p>{option.label}</p>
									<p class="text-xs text-muted-foreground">{option.description}</p>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if needsDuration}
				<div class="space-y-2">
					<Label for="duration">{m.admin_reports_duration()}</Label>
					<Input
						id="duration"
						type="number"
						min="1"
						placeholder="24"
						bind:value={sanctionDuration}
					/>
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="notes">{m.admin_reports_notes()}</Label>
				<Textarea
					id="notes"
					placeholder={m.admin_reports_notes_placeholder()}
					bind:value={notes}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (resolveDialogOpen = false)}>{m.common_cancel()}</Button>
			<Button
				onclick={handleResolve}
				disabled={resolveReportMutation.isPending || (needsDuration && !sanctionDuration)}
			>
				{resolveReportMutation.isPending ? m.admin_reports_resolving() : m.admin_reports_resolve_button()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
