<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { AvatarUpload, FriendsList, MatchHistory, StatsCard } from '$lib/components/profile';
	import { createMeQuery } from '$lib/queries/auth';
	import {
		createAcceptFriendRequestMutation,
		createFriendsQuery,
		createMyMatchesQuery,
		createMyStatsQuery,
		createPendingRequestsQuery,
		createRejectFriendRequestMutation,
		createRemoveAvatarMutation,
		createRemoveFriendMutation,
		createUpdateProfileMutation,
		createUpdateUsernameMutation,
		createUploadAvatarMutation
	} from '$lib/queries/users';
	import { toast } from 'svelte-sonner';
	import PencilIcon from '@lucide/svelte/icons/pencil';

	// Queries
	const meQuery = createMeQuery();
	const statsQuery = createMyStatsQuery();
	const friendsQuery = createFriendsQuery();
	const pendingRequestsQuery = createPendingRequestsQuery();

	// Mutations
	const updateProfileMutation = createUpdateProfileMutation();
	const updateUsernameMutation = createUpdateUsernameMutation();
	const uploadAvatarMutation = createUploadAvatarMutation();
	const removeAvatarMutation = createRemoveAvatarMutation();
	const removeFriendMutation = createRemoveFriendMutation();
	const acceptRequestMutation = createAcceptFriendRequestMutation();
	const rejectRequestMutation = createRejectFriendRequestMutation();

	// Match history state
	let matchFilter = $state('all');
	let matchesOffset = $state(0);

	// Create matches query with current filter
	const matchesQuery = $derived(
		createMyMatchesQuery({
			limit: 10,
			offset: matchesOffset,
			result: matchFilter === 'all' ? undefined : (matchFilter as 'win' | 'loss')
		})
	);

	// Edit profile dialog
	let showEditDialog = $state(false);
	let newDisplayName = $state('');
	let newUsername = $state('');

	// Username validation
	const usernameValid = $derived(
		newUsername.length >= 3 &&
			newUsername.length <= 20 &&
			/^[a-z0-9_]+$/.test(newUsername)
	);

	function openEditDialog() {
		if (meQuery.data) {
			newDisplayName = meQuery.data.displayName;
			newUsername = meQuery.data.username;
			showEditDialog = true;
		}
	}

	async function saveProfile() {
		if (!newDisplayName.trim()) return;

		const user = meQuery.data;
		if (!user) return;

		try {
			// Update display name if changed
			if (newDisplayName.trim() !== user.displayName) {
				await updateProfileMutation.mutateAsync({ displayName: newDisplayName.trim() });
			}

			// Update username if changed and valid
			if (newUsername !== user.username) {
				if (!usernameValid) {
					toast.error('Invalid username format');
					return;
				}
				await updateUsernameMutation.mutateAsync({ username: newUsername });
			}

			showEditDialog = false;
			toast.success('Profile updated!');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update';
			toast.error(message);
		}
	}

	async function handleAvatarUpload(file: File) {
		await uploadAvatarMutation.mutateAsync(file);
	}

	async function handleAvatarRemove() {
		await removeAvatarMutation.mutateAsync();
	}

	function handleFilterChange(filter: string) {
		matchFilter = filter;
		matchesOffset = 0;
	}

	function handleLoadMore() {
		matchesOffset += 10;
	}

	async function handleRemoveFriend(userId: number) {
		try {
			await removeFriendMutation.mutateAsync(userId);
			toast.success('Friend removed');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to remove friend';
			toast.error(message);
		}
	}

	async function handleAcceptRequest(requestId: number) {
		try {
			await acceptRequestMutation.mutateAsync(requestId);
			toast.success('Friend request accepted!');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to accept request';
			toast.error(message);
		}
	}

	async function handleRejectRequest(requestId: number) {
		try {
			await rejectRequestMutation.mutateAsync(requestId);
			toast.success('Friend request declined');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to reject request';
			toast.error(message);
		}
	}
</script>

<svelte:head>
	<title>Profile | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	{#if meQuery.isPending}
		<div class="space-y-6">
			<Card>
				<CardContent class="p-6">
					<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
						<Skeleton class="h-32 w-32 rounded-full" />
						<div class="flex-1 space-y-3">
							<Skeleton class="h-8 w-48" />
							<Skeleton class="h-4 w-32" />
						</div>
					</div>
				</CardContent>
			</Card>
			<Skeleton class="h-64 w-full" />
		</div>
	{:else if meQuery.error}
		<Card>
			<CardContent class="p-6 text-center">
				<p class="text-muted-foreground">
					Please <a href="/auth/login" class="font-medium text-primary underline">log in</a> to view your
					profile.
				</p>
			</CardContent>
		</Card>
	{:else if meQuery.data}
		{@const user = meQuery.data}

		<Card class="mb-6">
			<CardContent class="p-6">
				<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
					<div class="text-center">
						<AvatarUpload
							avatarUrl={user.avatarUrl}
							displayName={user.displayName}
							onUpload={handleAvatarUpload}
							onRemove={handleAvatarRemove}
							loading={uploadAvatarMutation.isPending || removeAvatarMutation.isPending}
						/>
					</div>

					<div class="flex-1 text-center sm:text-left">
						<div class="flex flex-col items-center gap-2 sm:flex-row">
							<h1 class="text-2xl font-bold">
								{user.displayName}<span class="text-muted-foreground">#{user.username}</span>
							</h1>
							<Button variant="ghost" size="sm" onclick={openEditDialog}>
								<PencilIcon class="size-4" />
							</Button>
						</div>
						<p class="mt-1 text-muted-foreground">{user.email}</p>

						<div class="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
							{#if user.emailVerified}
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
								>
									Verified
								</span>
							{:else}
								<span
									class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800"
								>
									Unverified
								</span>
							{/if}
							{#if user.twoFactorEnabled}
								<span
									class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
								>
									2FA Enabled
								</span>
							{/if}
							{#if user.intraId}
								<span
									class="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800"
								>
									42 Linked
								</span>
							{/if}
						</div>

						<div class="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
							<Button variant="outline" size="sm" onclick={() => goto('/settings')}>
								Settings
							</Button>
							<Button variant="outline" size="sm" onclick={() => goto('/settings/security')}>
								Security
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>

		<Tabs value="overview" class="space-y-6">
			<TabsList class="grid w-full grid-cols-3">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="matches">Match History</TabsTrigger>
				<TabsTrigger value="friends">Friends</TabsTrigger>
			</TabsList>

			<TabsContent value="overview" class="space-y-6">
				<StatsCard stats={statsQuery.data} loading={statsQuery.isPending} />

				<Card>
					<CardHeader class="flex flex-row items-center justify-between pb-2">
						<CardTitle class="text-lg">Recent Matches</CardTitle>
						<Button variant="ghost" size="sm" onclick={() => {}}>View All</Button>
					</CardHeader>
					<CardContent>
						{#if matchesQuery.isPending}
							<div class="space-y-3">
								{#each Array(3) as _}
									<Skeleton class="h-16 w-full" />
								{/each}
							</div>
						{:else if matchesQuery.data?.matches.length === 0}
							<p class="py-4 text-center text-muted-foreground">No matches yet. Start playing!</p>
						{:else if matchesQuery.data}
							<div class="space-y-2">
								{#each matchesQuery.data.matches.slice(0, 5) as match}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div class="flex items-center gap-3">
											<span class="font-medium">{match.opponent.displayName}</span>
										</div>
										<div class="flex items-center gap-3">
											<span class="font-mono">{match.playerScore} - {match.opponentScore}</span>
											<span
												class={`rounded-full px-2 py-0.5 text-xs font-medium ${
													match.result === 'win'
														? 'bg-green-100 text-green-800'
														: match.result === 'loss'
															? 'bg-red-100 text-red-800'
															: 'bg-muted text-muted-foreground'
												}`}
											>
												{match.result.charAt(0).toUpperCase() + match.result.slice(1)}
											</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="matches">
				<MatchHistory
					matches={matchesQuery.data?.matches ?? []}
					total={matchesQuery.data?.total ?? 0}
					hasMore={matchesQuery.data?.hasMore ?? false}
					loading={matchesQuery.isPending}
					currentFilter={matchFilter}
					onFilterChange={handleFilterChange}
					onLoadMore={handleLoadMore}
				/>
			</TabsContent>

			<TabsContent value="friends">
				<FriendsList
					friends={friendsQuery.data ?? []}
					pendingRequests={pendingRequestsQuery.data ?? []}
					loading={friendsQuery.isPending || pendingRequestsQuery.isPending}
					showPending={true}
					onRemoveFriend={handleRemoveFriend}
					onAcceptRequest={handleAcceptRequest}
					onRejectRequest={handleRejectRequest}
				/>
			</TabsContent>
		</Tabs>
	{/if}
</div>

<Dialog bind:open={showEditDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Edit Profile</DialogTitle>
			<DialogDescription>Update your display name and username.</DialogDescription>
		</DialogHeader>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="displayName">Display Name</Label>
				<Input
					id="displayName"
					bind:value={newDisplayName}
					placeholder="Enter your display name"
					maxlength={50}
				/>
				<p class="text-xs text-muted-foreground">This is how your name appears to others.</p>
			</div>

			<div class="space-y-2">
				<Label for="username">Username</Label>
				<Input
					id="username"
					bind:value={newUsername}
					placeholder="your_username"
					minlength={3}
					maxlength={20}
					pattern="^[a-z0-9_]+$"
				/>
				<p class="text-xs text-muted-foreground">
					3-20 characters. Lowercase letters, numbers, and underscores only.
				</p>
				{#if newUsername && !usernameValid}
					<p class="text-xs text-destructive">Invalid username format.</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					Note: You can only change your username once every 30 days.
				</p>
			</div>
		</div>
		<DialogFooter>
			<Button variant="outline" onclick={() => (showEditDialog = false)}>Cancel</Button>
			<Button
				onclick={saveProfile}
				disabled={updateProfileMutation.isPending ||
					updateUsernameMutation.isPending ||
					!newDisplayName.trim()}
			>
				{#if updateProfileMutation.isPending || updateUsernameMutation.isPending}
					Saving...
				{:else}
					Save
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
