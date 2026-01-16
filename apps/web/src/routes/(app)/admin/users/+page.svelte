<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import * as Table from "$lib/components/ui/table";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Select from "$lib/components/ui/select";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import { Badge } from "$lib/components/ui/badge";
	import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import {
		createAdminUsersQuery,
		createUpdateRoleMutation,
		createDeleteUserMutation,
		getRoleColor,
		getRoleText,
		type AdminUser,
		type UserRole,
	} from "$lib/queries/moderation";
	import { createMeQuery } from "$lib/queries/auth";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import UserCogIcon from "@lucide/svelte/icons/user-cog";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import CheckIcon from "@lucide/svelte/icons/check";

	const meQuery = createMeQuery();
	const updateRoleMutation = createUpdateRoleMutation();
	const deleteUserMutation = createDeleteUserMutation();

	let search = $state("");
	let roleFilter = $state<string | undefined>(undefined);
	let currentPage = $state(0);
	const pageSize = 20;

	const usersQuery = $derived(
		createAdminUsersQuery({
			limit: pageSize,
			offset: currentPage * pageSize,
			search: search || undefined,
			role: roleFilter ? (roleFilter as UserRole) : undefined,
			sortBy: "createdAt",
			sortOrder: "desc",
		})
	);

	// Dialog state
	let roleDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let selectedUser = $state<AdminUser | null>(null);
	let newRole = $state<string>("user");
	let roleReason = $state("");
	let deleteReason = $state("");

	function openRoleDialog(user: AdminUser) {
		selectedUser = user;
		newRole = user.role;
		roleReason = "";
		roleDialogOpen = true;
	}

	function openDeleteDialog(user: AdminUser) {
		selectedUser = user;
		deleteReason = "";
		deleteDialogOpen = true;
	}

	async function handleRoleChange() {
		if (!selectedUser) return;

		updateRoleMutation.mutate(
			{
				userId: selectedUser.id,
				role: newRole as UserRole,
				reason: roleReason || undefined,
			},
			{
				onSuccess: () => {
					roleDialogOpen = false;
					selectedUser = null;
				},
			}
		);
	}

	async function handleDelete() {
		if (!selectedUser || !deleteReason.trim()) return;

		deleteUserMutation.mutate(
			{
				userId: selectedUser.id,
				reason: deleteReason.trim(),
			},
			{
				onSuccess: () => {
					deleteDialogOpen = false;
					selectedUser = null;
				},
			}
		);
	}

	function getInitials(name: string): string {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	const totalPages = $derived(Math.ceil((usersQuery.data?.total ?? 0) / pageSize));
	const canGoBack = $derived(currentPage > 0);
	const canGoNext = $derived(currentPage < totalPages - 1);

	const roleOptions: { value: UserRole; label: string }[] = [
		{ value: "user", label: "User" },
		{ value: "moderator", label: "Moderator" },
		{ value: "admin", label: "Admin" },
	];
</script>

<svelte:head>
	<title>User Management | Admin | ft_transcendence</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">User Management</h1>
		<p class="text-muted-foreground">View and manage platform users</p>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search by name or email..."
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
					{roleFilter ? getRoleText(roleFilter as UserRole) : "All Roles"}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">All Roles</Select.Item>
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
					<Table.Head class="w-[250px]">User</Table.Head>
					<Table.Head>Role</Table.Head>
					<Table.Head class="hidden md:table-cell">Status</Table.Head>
					<Table.Head class="hidden lg:table-cell">Joined</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
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
							<p class="text-muted-foreground">Failed to load users. Please try again.</p>
						</Table.Cell>
					</Table.Row>
				{:else if usersQuery.data?.users.length === 0}
					<Table.Row>
						<Table.Cell colspan={5} class="h-32 text-center">
							<p class="text-muted-foreground">No users found.</p>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each usersQuery.data?.users ?? [] as user}
						{@const isSelf = user.id === meQuery.data?.id}
						{@const isAdmin = user.role === "admin"}
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
										<Badge variant="outline" class="text-green-600">Verified</Badge>
									{:else}
										<Badge variant="outline" class="text-yellow-600">Unverified</Badge>
									{/if}
									{#if user.activeSanctions > 0}
										<Badge variant="destructive">{user.activeSanctions} Sanctions</Badge>
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
										disabled={isSelf || (isAdmin && meQuery.data?.role !== "admin")}
										title={isSelf ? "Cannot change own role" : isAdmin ? "Cannot modify admin" : "Change role"}
									>
										<UserCogIcon class="size-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										onclick={() => openDeleteDialog(user)}
										disabled={isSelf || isAdmin}
										title={isSelf ? "Cannot delete yourself" : isAdmin ? "Cannot delete admin" : "Delete user"}
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
					Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, usersQuery.data?.total ?? 0)} of {usersQuery.data?.total ?? 0} users
				</p>
				<div class="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						disabled={!canGoBack}
						onclick={() => (currentPage -= 1)}
					>
						<ChevronLeftIcon class="size-4" />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canGoNext}
						onclick={() => (currentPage += 1)}
					>
						Next
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
			<Dialog.Title>Change User Role</Dialog.Title>
			<Dialog.Description>
				Change the role for {selectedUser?.displayName}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label>New Role</Label>
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
				<Label for="roleReason">Reason (optional)</Label>
				<Textarea
					id="roleReason"
					placeholder="Enter a reason for this change..."
					bind:value={roleReason}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (roleDialogOpen = false)}>Cancel</Button>
			<Button onclick={handleRoleChange} disabled={updateRoleMutation.isPending}>
				{updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete User Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete User</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete {selectedUser?.displayName}? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="deleteReason">Reason (required)</Label>
				<Textarea
					id="deleteReason"
					placeholder="Enter a reason for deleting this user..."
					bind:value={deleteReason}
					required
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
			<Button
				variant="destructive"
				onclick={handleDelete}
				disabled={deleteUserMutation.isPending || !deleteReason.trim()}
			>
				{deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
