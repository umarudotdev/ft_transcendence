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
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime';
	import {
		createAdminUsersQuery,
		createUpdateRoleMutation,
		createDeleteUserMutation,
		getRoleColor,
		getRoleText,
		type AdminUser,
		type UserRole
	} from '$lib/queries/moderation';
	import { createMeQuery } from '$lib/queries/auth';
	import { getInitials } from '$lib/utils';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import UserCogIcon from '@lucide/svelte/icons/user-cog';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import CheckIcon from '@lucide/svelte/icons/check';

	const meQuery = createMeQuery();
	const updateRoleMutation = createUpdateRoleMutation();
	const deleteUserMutation = createDeleteUserMutation();

	let search = $state('');
	let roleFilter = $state<string | undefined>(undefined);
	let currentPage = $state(0);
	const pageSize = 20;

	const usersQuery = $derived(
		createAdminUsersQuery({
			limit: pageSize,
			offset: currentPage * pageSize,
			search: search || undefined,
			role: roleFilter ? (roleFilter as UserRole) : undefined,
			sortBy: 'createdAt',
			sortOrder: 'desc'
		})
	);

	// Dialog state
	let roleDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let selectedUser = $state<AdminUser | null>(null);
	let newRole = $state<string>('user');
	let roleReason = $state('');
	let deleteReason = $state('');

	function openRoleDialog(user: AdminUser) {
		selectedUser = user;
		newRole = user.role;
		roleReason = '';
		roleDialogOpen = true;
	}

	function openDeleteDialog(user: AdminUser) {
		selectedUser = user;
		deleteReason = '';
		deleteDialogOpen = true;
	}

	async function handleRoleChange() {
		if (!selectedUser) return;

		updateRoleMutation.mutate(
			{
				userId: selectedUser.id,
				role: newRole as UserRole,
				reason: roleReason || undefined
			},
			{
				onSuccess: () => {
					roleDialogOpen = false;
					selectedUser = null;
				}
			}
		);
	}

	async function handleDelete() {
		if (!selectedUser || !deleteReason.trim()) return;

		deleteUserMutation.mutate(
			{
				userId: selectedUser.id,
				reason: deleteReason.trim()
			},
			{
				onSuccess: () => {
					deleteDialogOpen = false;
					selectedUser = null;
				}
			}
		);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	const totalPages = $derived(Math.ceil((usersQuery.data?.total ?? 0) / pageSize));
	const canGoBack = $derived(currentPage > 0);
	const canGoNext = $derived(currentPage < totalPages - 1);

	const roleOptions = $derived([
		{ value: 'user' as UserRole, label: m.admin_users_role_user() },
		{ value: 'moderator' as UserRole, label: m.admin_users_role_moderator() },
		{ value: 'admin' as UserRole, label: m.admin_users_role_admin() }
	]);
</script>

<svelte:head>
	<title>{m.admin_users_title()} | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m.admin_users_title()}</h1>
		<p class="text-muted-foreground">{m.admin_users_subtitle()}</p>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					placeholder={m.admin_users_search_placeholder()}
					class="pl-9"
					bind:value={search}
				/>
			</div>
			<Select.Root
				type="single"
				bind:value={roleFilter}
				onValueChange={() => {
					currentPage = 0;
				}}
			>
				<Select.Trigger class="w-full sm:w-40">
					{roleFilter ? getRoleText(roleFilter as UserRole) : m.admin_users_all_roles()}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">{m.admin_users_all_roles()}</Select.Item>
					{#each roleOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</Card.Content>
	</Card.Root>

	<!-- Users Table -->
	<Card.Root>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[250px]">{m.admin_users_user_column()}</Table.Head>
					<Table.Head>{m.admin_users_role_column()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m.admin_users_status_column()}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{m.admin_users_joined_column()}</Table.Head>
					<Table.Head class="text-right">{m.admin_users_actions_column()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if usersQuery.isPending}
					{#each Array(5) as _}
						<Table.Row>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<Skeleton class="size-10 rounded-full" />
									<div class="space-y-1">
										<Skeleton class="h-4 w-32" />
										<Skeleton class="h-3 w-40" />
									</div>
								</div>
							</Table.Cell>
							<Table.Cell><Skeleton class="h-5 w-20" /></Table.Cell>
							<Table.Cell class="hidden md:table-cell"><Skeleton class="h-5 w-16" /></Table.Cell>
							<Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-24" /></Table.Cell>
							<Table.Cell><Skeleton class="ml-auto h-8 w-20" /></Table.Cell>
						</Table.Row>
					{/each}
				{:else if usersQuery.error}
					<Table.Row>
						<Table.Cell colspan={5} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_users_failed()}</p>
						</Table.Cell>
					</Table.Row>
				{:else if usersQuery.data?.users.length === 0}
					<Table.Row>
						<Table.Cell colspan={5} class="h-32 text-center">
							<p class="text-muted-foreground">{m.admin_users_no_users()}</p>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each usersQuery.data?.users ?? [] as user}
						{@const isSelf = user.id === meQuery.data?.id}
						{@const isAdmin = user.role === 'admin'}
						<Table.Row>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<Avatar class="size-10">
										{#if user.avatarUrl}
											<AvatarImage src={user.avatarUrl} alt={user.displayName} />
										{/if}
										<AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
									</Avatar>
									<div>
										<p class="font-medium">{user.displayName}</p>
										<p class="text-sm text-muted-foreground">{user.email}</p>
									</div>
								</div>
							</Table.Cell>
							<Table.Cell>
								<Badge variant="secondary" class={getRoleColor(user.role)}>
									{getRoleText(user.role)}
								</Badge>
							</Table.Cell>
							<Table.Cell class="hidden md:table-cell">
								<div class="flex flex-wrap gap-1">
									{#if user.emailVerified}
										<Badge variant="outline" class="text-green-600">{m.common_verified()}</Badge>
									{:else}
										<Badge variant="outline" class="text-yellow-600">{m.common_unverified()}</Badge>
									{/if}
									{#if user.activeSanctions > 0}
										<Badge variant="destructive">{m.admin_users_sanctions_count({ count: user.activeSanctions })}</Badge>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell class="hidden lg:table-cell">
								{formatDate(user.createdAt)}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-1">
									<Button
										variant="ghost"
										size="icon"
										onclick={() => openRoleDialog(user)}
										disabled={isSelf || (isAdmin && meQuery.data?.role !== 'admin')}
										title={isSelf
											? m.admin_users_cannot_change_own()
											: isAdmin
												? m.admin_users_cannot_modify_admin()
												: m.admin_users_change_role()}
									>
										<UserCogIcon class="size-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										onclick={() => openDeleteDialog(user)}
										disabled={isSelf || isAdmin}
										title={isSelf
											? m.admin_users_cannot_delete_self()
											: isAdmin
												? m.admin_users_cannot_delete_admin()
												: m.admin_users_delete_title()}
									>
										<TrashIcon class="size-4" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>

		<!-- Pagination -->
		{#if (usersQuery.data?.total ?? 0) > pageSize}
			<div class="flex items-center justify-between border-t px-4 py-3">
				<p class="text-sm text-muted-foreground">
					{m.common_showing_range({ start: currentPage * pageSize + 1, end: Math.min(
						(currentPage + 1) * pageSize,
						usersQuery.data?.total ?? 0
					), total: usersQuery.data?.total ?? 0 })}
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

<!-- Role Change Dialog -->
<Dialog.Root bind:open={roleDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.admin_users_change_role_title()}</Dialog.Title>
			<Dialog.Description>
				{m.admin_users_change_role_for({ name: selectedUser?.displayName ?? '' })}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label>{m.admin_users_new_role()}</Label>
				<Select.Root type="single" bind:value={newRole}>
					<Select.Trigger>
						{getRoleText(newRole as UserRole)}
					</Select.Trigger>
					<Select.Content>
						{#each roleOptions as option}
							<Select.Item value={option.value}>
								<div class="flex items-center gap-2">
									{#if option.value === newRole}
										<CheckIcon class="size-4" />
									{:else}
										<span class="size-4"></span>
									{/if}
									{option.label}
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="space-y-2">
				<Label for="roleReason">{m.admin_users_reason_optional()}</Label>
				<Textarea
					id="roleReason"
					placeholder={m.admin_users_reason_placeholder()}
					bind:value={roleReason}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (roleDialogOpen = false)}>{m.common_cancel()}</Button>
			<Button onclick={handleRoleChange} disabled={updateRoleMutation.isPending}>
				{updateRoleMutation.isPending ? m.admin_users_saving() : m.admin_users_save_changes()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete User Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.admin_users_delete_title()}</Dialog.Title>
			<Dialog.Description>
				{m.admin_users_delete_confirm({ name: selectedUser?.displayName ?? '' })}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="deleteReason">{m.admin_users_delete_reason()}</Label>
				<Textarea
					id="deleteReason"
					placeholder={m.admin_users_delete_reason_placeholder()}
					bind:value={deleteReason}
					required
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>{m.common_cancel()}</Button>
			<Button
				variant="destructive"
				onclick={handleDelete}
				disabled={deleteUserMutation.isPending || !deleteReason.trim()}
			>
				{deleteUserMutation.isPending ? m.admin_users_deleting() : m.admin_users_delete_button()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
