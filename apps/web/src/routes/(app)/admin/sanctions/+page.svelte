<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime';
	import {
		createSanctionsQuery,
		createRevokeSanctionMutation,
		getSanctionColor,
		type Sanction,
		type SanctionType
	} from '$lib/queries/moderation';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import XIcon from '@lucide/svelte/icons/x';

	const revokeSanctionMutation = createRevokeSanctionMutation();

	let typeFilter = $state<string | undefined>(undefined);
	let activeFilter = $state<string | undefined>('true');
	let currentPage = $state(0);
	const pageSize = 20;

	const sanctionsQuery = $derived(
		createSanctionsQuery({
			limit: pageSize,
			offset: currentPage * pageSize,
			type: typeFilter ? (typeFilter as SanctionType) : undefined,
			isActive: activeFilter ? activeFilter === 'true' : undefined
		})
	);

	// Dialog state
	let revokeDialogOpen = $state(false);
	let selectedSanction = $state<Sanction | null>(null);

	function openRevokeDialog(sanction: Sanction) {
		selectedSanction = sanction;
		revokeDialogOpen = true;
	}

	async function handleRevoke() {
		if (!selectedSanction) return;

		revokeSanctionMutation.mutate(selectedSanction.id, {
			onSuccess: () => {
				revokeDialogOpen = false;
				selectedSanction = null;
			}
		});
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

	function getSanctionTypeText(type: SanctionType): string {
		const types: Record<SanctionType, () => string> = {
			warning: m.admin_sanctions_warning,
			timeout: m.admin_sanctions_timeout,
			ban: m.admin_sanctions_ban
		};
		return types[type]();
	}

	const totalPages = $derived(Math.ceil((sanctionsQuery.data?.total ?? 0) / pageSize));
	const canGoBack = $derived(currentPage > 0);
	const canGoNext = $derived(currentPage < totalPages - 1);

	const typeOptions = $derived([
		{ value: 'warning' as SanctionType, label: m.admin_sanctions_warning() },
		{ value: 'timeout' as SanctionType, label: m.admin_sanctions_timeout() },
		{ value: 'ban' as SanctionType, label: m.admin_sanctions_ban() }
	]);

	const activeOptions = $derived([
		{ value: 'true', label: m.admin_sanctions_active() },
		{ value: 'false', label: m.admin_sanctions_inactive() }
	]);
</script>

<svelte:head>
	<title>{m.admin_sanctions_title()} | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m.admin_sanctions_title()}</h1>
		<p class="text-muted-foreground">{m.admin_sanctions_subtitle()}</p>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
			<Select.Root
				type="single"
				bind:value={typeFilter}
				onValueChange={() => {
					currentPage = 0;
				}}
			>
				<Select.Trigger class="w-full sm:w-40">
					{typeFilter ? getSanctionTypeText(typeFilter as SanctionType) : m.admin_sanctions_all_types()}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">{m.admin_sanctions_all_types()}</Select.Item>
					{#each typeOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				bind:value={activeFilter}
				onValueChange={() => {
					currentPage = 0;
				}}
			>
				<Select.Trigger class="w-full sm:w-40">
					{activeFilter === 'true'
						? m.admin_sanctions_active()
						: activeFilter === 'false'
							? m.admin_sanctions_inactive()
							: m.admin_sanctions_all_status()}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">{m.admin_sanctions_all_status()}</Select.Item>
					{#each activeOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</Card.Content>
	</Card.Root>

	<!-- Sanctions Table -->
	<Card.Root>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.admin_sanctions_user()}</Table.Head>
					<Table.Head>{m.admin_sanctions_type()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m.admin_sanctions_reason()}</Table.Head>
					<Table.Head>{m.admin_sanctions_status()}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{m.admin_sanctions_issued()}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{m.admin_sanctions_expires()}</Table.Head>
					<Table.Head class="text-right">{m.admin_sanctions_actions()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if sanctionsQuery.isPending}
					{#each Array(5) as _}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
							<Table.Cell class="hidden md:table-cell"><Skeleton class="h-4 w-40" /></Table.Cell>
							<Table.Cell><Skeleton class="h-5 w-16" /></Table.Cell>
							<Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-28" /></Table.Cell>
							<Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-28" /></Table.Cell>
							<Table.Cell><Skeleton class="ml-auto h-8 w-16" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if sanctionsQuery.error}
					<Table.Row>
						<Table.Cell colspan={7} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_sanctions_failed()}</p>
						</Table.Cell>
					</Table.Row>
				{:else if sanctionsQuery.data?.sanctions.length === 0}
					<Table.Row>
						<Table.Cell colspan={7} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_sanctions_no_sanctions()}</p>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each sanctionsQuery.data?.sanctions ?? [] as sanction}
						<Table.Row>
							<Table.Cell class="font-medium">{sanction.userName}</Table.Cell>
							<Table.Cell>
								<Badge class={getSanctionColor(sanction.type)}>
									{getSanctionTypeText(sanction.type)}
								</Badge>
							</Table.Cell>
							<Table.Cell class="hidden max-w-[200px] truncate md:table-cell">
								{sanction.reason}
							</Table.Cell>
							<Table.Cell>
								{#if sanction.isActive}
									<Badge variant="default">{m.admin_sanctions_active()}</Badge>
								{:else}
									<Badge variant="secondary">{m.admin_sanctions_revoked()}</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell class="hidden lg:table-cell">
								{formatDate(sanction.createdAt)}
							</Table.Cell>
							<Table.Cell class="hidden lg:table-cell">
								{#if sanction.expiresAt}
									{formatDate(sanction.expiresAt)}
								{:else}
									<span class="text-muted-foreground">{m.admin_sanctions_never()}</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								{#if sanction.isActive && sanction.type !== 'warning'}
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										onclick={() => openRevokeDialog(sanction)}
										title={m.admin_sanctions_revoke_tooltip()}
									>
										<XIcon class="size-4" />
									</Button>
								{:else}
									<span class="text-sm text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>

		<!-- Pagination -->
		{#if (sanctionsQuery.data?.total ?? 0) > pageSize}
			<div class="flex items-center justify-between border-t px-4 py-3">
				<p class="text-sm text-muted-foreground">
					{m.common_showing_range({ start: currentPage * pageSize + 1, end: Math.min(
						(currentPage + 1) * pageSize,
						sanctionsQuery.data?.total ?? 0
					), total: sanctionsQuery.data?.total ?? 0 })}
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

<!-- Revoke Sanction Dialog -->
<Dialog.Root bind:open={revokeDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.admin_sanctions_revoke_title()}</Dialog.Title>
			<Dialog.Description>
				{#if selectedSanction}
					{m.admin_sanctions_revoke_confirm({ type: getSanctionTypeText(
						selectedSanction.type
					).toLowerCase(), name: selectedSanction.userName })}
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<div class="py-4">
			{#if selectedSanction}
				<p class="text-sm text-muted-foreground">
					<strong>{m.admin_sanctions_reason_label()}</strong>
					{selectedSanction.reason}
				</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (revokeDialogOpen = false)}>{m.common_cancel()}</Button>
			<Button
				variant="destructive"
				onclick={handleRevoke}
				disabled={revokeSanctionMutation.isPending}
			>
				{revokeSanctionMutation.isPending ? m.admin_sanctions_revoking() : m.admin_sanctions_revoke_button()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
