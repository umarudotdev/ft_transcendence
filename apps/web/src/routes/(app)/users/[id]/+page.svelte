<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { MatchHistory, StatsCard } from '$lib/components/profile';
	import { createMeQuery } from '$lib/queries/auth';
	import {
		createBlockUserMutation,
		createRemoveFriendMutation,
		createSendFriendRequestMutation,
		createUserMatchesQuery,
		createUserProfileQuery,
		createUserStatsQuery,
		type FriendshipStatus
	} from '$lib/queries/users';
	import { createDMMutation } from '$lib/queries/chat';
	import { getInitials } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import CheckIcon from '@lucide/svelte/icons/check';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';

	// Get user ID from URL
	const userId = $derived(Number.parseInt($page.params.id ?? '0', 10));

	// Queries
	const meQuery = createMeQuery();
	const profileQuery = $derived(createUserProfileQuery(userId));
	const statsQuery = $derived(createUserStatsQuery(userId));

	// Mutations
	const sendRequestMutation = createSendFriendRequestMutation();
	const removeFriendMutation = createRemoveFriendMutation();
	const blockUserMutation = createBlockUserMutation();
	const dmMutation = createDMMutation();

	// Match history state
	let matchFilter = $state('all');
	let matchesOffset = $state(0);

	// Create matches query with current filter
	const matchesQuery = $derived(
		createUserMatchesQuery(userId, {
			limit: 10,
			offset: matchesOffset,
			result: matchFilter === 'all' ? undefined : (matchFilter as 'win' | 'loss')
		})
	);

	// Check if viewing own profile
	const isOwnProfile = $derived(meQuery.data?.id === userId);

	function formatJoinDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'long',
			year: 'numeric'
		}).format(date);
	}

	async function handleAddFriend() {
		try {
			await sendRequestMutation.mutateAsync(userId);
			toast.success('Friend request sent!');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to send request';
			toast.error(message);
		}
	}

	async function handleRemoveFriend() {
		try {
			await removeFriendMutation.mutateAsync(userId);
			toast.success('Friend removed');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to remove friend';
			toast.error(message);
		}
	}

	async function handleBlock() {
		try {
			await blockUserMutation.mutateAsync(userId);
			toast.success('User blocked');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to block user';
			toast.error(message);
		}
	}

	async function handleMessage() {
		try {
			const result = await dmMutation.mutateAsync(userId);
			goto(`/chat/${result.channelId}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to start conversation';
			toast.error(message);
		}
	}

	function handleFilterChange(filter: string) {
		matchFilter = filter;
		matchesOffset = 0;
	}

	function handleLoadMore() {
		matchesOffset += 10;
	}

	function getFriendButtonProps(status: FriendshipStatus): {
		label: string;
		variant: 'default' | 'outline' | 'secondary' | 'destructive';
		action: (() => void) | null;
		disabled?: boolean;
	} {
		switch (status) {
			case 'none':
				return {
					label: 'Add Friend',
					variant: 'default',
					action: handleAddFriend
				};
			case 'friends':
				return {
					label: 'Remove Friend',
					variant: 'outline',
					action: handleRemoveFriend
				};
			case 'pending_sent':
				return {
					label: 'Request Pending',
					variant: 'secondary',
					action: null,
					disabled: true
				};
			case 'pending_received':
				return {
					label: 'Respond to Request',
					variant: 'default',
					action: () => goto('/profile')
				};
			case 'blocked':
				return {
					label: 'Blocked',
					variant: 'secondary',
					action: null,
					disabled: true
				};
			case 'blocked_by':
				return {
					label: 'Unavailable',
					variant: 'secondary',
					action: null,
					disabled: true
				};
			default:
				return {
					label: 'Add Friend',
					variant: 'default',
					action: handleAddFriend
				};
		}
	}
</script>

<svelte:head>
	<title>
		{profileQuery.data?.user.displayName ?? 'User Profile'} | ft_transcendence
	</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	{#if isOwnProfile}
		<Card>
			<CardContent class="p-6 text-center">
				<p class="text-muted-foreground">
					This is your profile.
					<a href="/profile" class="font-medium text-primary underline">
						Go to your profile page
					</a>
				</p>
			</CardContent>
		</Card>
	{:else if profileQuery.isPending}
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
	{:else if !profileQuery.data}
		<Card>
			<CardContent class="p-6 text-center">
				<p class="text-muted-foreground">User not found.</p>
				<Button variant="outline" class="mt-4" onclick={() => goto('/')}>Go Home</Button>
			</CardContent>
		</Card>
	{:else}
		{@const { user, friendshipStatus } = profileQuery.data}
		{@const friendButton = getFriendButtonProps(friendshipStatus)}

		<Card class="mb-6">
			<CardContent class="p-6">
				<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
					<Avatar class="h-24 w-24 sm:h-32 sm:w-32">
						{#if user.avatarUrl}
							<AvatarImage src={user.avatarUrl} alt={user.displayName} />
						{/if}
						<AvatarFallback class="text-2xl sm:text-3xl">
							{getInitials(user.displayName)}
						</AvatarFallback>
					</Avatar>

					<div class="flex-1 text-center sm:text-left">
						<h1 class="text-2xl font-bold">{user.displayName}</h1>
						<p class="mt-1 text-muted-foreground">
							Member since {formatJoinDate(user.createdAt)}
						</p>

						{#if friendshipStatus === 'friends'}
							<Badge variant="secondary" class="mt-2">
								<CheckIcon class="mr-1 size-3" />
								Friends
							</Badge>
						{/if}

						<div class="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
							{#if friendButton.action}
								<Button
									variant={friendButton.variant}
									onclick={friendButton.action}
									disabled={friendButton.disabled ||
										sendRequestMutation.isPending ||
										removeFriendMutation.isPending}
								>
									{friendButton.label}
								</Button>
							{:else}
								<Button variant={friendButton.variant} disabled={friendButton.disabled}>
									{friendButton.label}
								</Button>
							{/if}

							{#if friendshipStatus !== 'blocked' && friendshipStatus !== 'blocked_by'}
								<Button variant="outline" onclick={handleMessage} disabled={dmMutation.isPending}>
									<MessageSquareIcon class="mr-2 size-4" />
									Message
								</Button>
							{/if}

							{#if friendshipStatus === 'friends'}
								<Button variant="outline">Challenge to Game</Button>
							{/if}

							{#if friendshipStatus !== 'blocked' && friendshipStatus !== 'blocked_by'}
								<Button
									variant="ghost"
									class="text-muted-foreground hover:text-destructive"
									onclick={handleBlock}
									disabled={blockUserMutation.isPending}
								>
									Block User
								</Button>
							{/if}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>

		<Tabs value="overview" class="space-y-6">
			<TabsList class="grid w-full grid-cols-2">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="matches">Match History</TabsTrigger>
			</TabsList>

			<TabsContent value="overview" class="space-y-6">
				<StatsCard stats={statsQuery.data} loading={statsQuery.isPending} />

				<Card>
					<CardContent class="p-4">
						<h3 class="mb-4 font-semibold">Recent Matches</h3>
						{#if matchesQuery.isPending}
							<div class="space-y-3">
								{#each Array(3) as _}
									<Skeleton class="h-12 w-full" />
								{/each}
							</div>
						{:else if matchesQuery.data?.matches.length === 0}
							<p class="py-4 text-center text-muted-foreground">No matches yet.</p>
						{:else if matchesQuery.data}
							<div class="space-y-2">
								{#each matchesQuery.data.matches.slice(0, 5) as match}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div class="flex items-center gap-3">
											<span>vs {match.opponent.displayName}</span>
										</div>
										<div class="flex items-center gap-3">
											<span class="font-mono">
												{match.playerScore} - {match.opponentScore}
											</span>
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
		</Tabs>
	{/if}
</div>
