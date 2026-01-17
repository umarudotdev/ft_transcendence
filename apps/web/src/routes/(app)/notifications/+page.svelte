<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		createNotificationsQuery,
		createMarkAsReadMutation,
		createMarkAllAsReadMutation,
		createDeleteNotificationMutation,
		getNotificationColor,
		type Notification
	} from '$lib/queries/notifications';
	import { toast } from 'svelte-sonner';
	import BellIcon from '@lucide/svelte/icons/bell';
	import GamepadIcon from '@lucide/svelte/icons/gamepad-2';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import InfoIcon from '@lucide/svelte/icons/info';
	import CheckCheckIcon from '@lucide/svelte/icons/check-check';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let offset = $state(0);
	const limit = 20;

	const notificationsQuery = $derived(createNotificationsQuery({ limit, offset }));
	const markAsReadMutation = createMarkAsReadMutation();
	const markAllAsReadMutation = createMarkAllAsReadMutation();
	const deleteMutation = createDeleteNotificationMutation();

	function getIcon(type: Notification['type']) {
		switch (type) {
			case 'match_invite':
				return GamepadIcon;
			case 'friend_request':
				return UserPlusIcon;
			case 'achievement':
				return TrophyIcon;
			case 'rank_change':
				return TrendingUpIcon;
			case 'system':
				return InfoIcon;
			default:
				return BellIcon;
		}
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleMarkAsRead(notification: Notification) {
		if (notification.isRead) return;
		try {
			await markAsReadMutation.mutateAsync(notification.id);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to mark as read';
			toast.error(message);
		}
	}

	async function handleMarkAllRead() {
		try {
			await markAllAsReadMutation.mutateAsync();
			toast.success('All notifications marked as read');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to mark all as read';
			toast.error(message);
		}
	}

	async function handleDelete(notificationId: number) {
		try {
			await deleteMutation.mutateAsync(notificationId);
			toast.success('Notification deleted');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete notification';
			toast.error(message);
		}
	}

	function handlePrevPage() {
		offset = Math.max(0, offset - limit);
	}

	function handleNextPage() {
		if (notificationsQuery.data?.hasMore) {
			offset += limit;
		}
	}
</script>

<svelte:head>
	<title>Notifications | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Notifications</h1>
			<p class="text-muted-foreground">Stay updated on your activity</p>
		</div>
		{#if notificationsQuery.data?.notifications.some((n) => !n.isRead)}
			<Button
				variant="outline"
				onclick={handleMarkAllRead}
				disabled={markAllAsReadMutation.isPending}
			>
				<CheckCheckIcon class="mr-2 size-4" />
				Mark all as read
			</Button>
		{/if}
	</div>

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<BellIcon class="size-5" />
				All Notifications
				{#if notificationsQuery.data}
					<span class="text-sm font-normal text-muted-foreground">
						({notificationsQuery.data.total})
					</span>
				{/if}
			</CardTitle>
		</CardHeader>
		<CardContent>
			{#if notificationsQuery.isPending}
				<div class="space-y-4">
					{#each Array(5) as _}
						<div class="flex gap-3">
							<Skeleton class="size-12 rounded-full" />
							<div class="flex-1 space-y-2">
								<Skeleton class="h-4 w-48" />
								<Skeleton class="h-3 w-full" />
								<Skeleton class="h-3 w-24" />
							</div>
						</div>
					{/each}
				</div>
			{:else if notificationsQuery.data?.notifications.length === 0}
				<div class="py-12 text-center">
					<BellIcon class="mx-auto mb-4 size-12 text-muted-foreground" />
					<p class="text-muted-foreground">No notifications yet</p>
					<p class="text-sm text-muted-foreground">
						You'll see notifications here when something important happens
					</p>
				</div>
			{:else if notificationsQuery.data}
				<div class="divide-y">
					{#each notificationsQuery.data.notifications as notification}
						{@const Icon = getIcon(notification.type)}
						<div class="flex items-start gap-4 py-4 {notification.isRead ? 'opacity-60' : ''}">
							<div
								class="flex size-12 shrink-0 items-center justify-center rounded-full {getNotificationColor(
									notification.type
								)}"
							>
								<Icon class="size-6" />
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-2">
									<div>
										<h3 class="font-medium">{notification.title}</h3>
										<p class="text-sm text-muted-foreground">
											{notification.message}
										</p>
										<p class="mt-1 text-xs text-muted-foreground">
											{formatDate(notification.createdAt)}
										</p>
									</div>

									<div class="flex items-center gap-1">
										{#if !notification.isRead}
											<Button
												variant="ghost"
												size="icon"
												class="size-8"
												onclick={() => handleMarkAsRead(notification)}
												disabled={markAsReadMutation.isPending}
											>
												<CheckCheckIcon class="size-4" />
											</Button>
										{/if}
										<Button
											variant="ghost"
											size="icon"
											class="size-8 text-muted-foreground hover:text-destructive"
											onclick={() => handleDelete(notification.id)}
											disabled={deleteMutation.isPending}
										>
											<TrashIcon class="size-4" />
										</Button>
									</div>
								</div>
							</div>

							{#if !notification.isRead}
								<div class="mt-2 size-2 shrink-0 rounded-full bg-blue-500"></div>
							{/if}
						</div>
					{/each}
				</div>

				{#if notificationsQuery.data.total > limit}
					<div class="mt-4 flex items-center justify-between border-t pt-4">
						<div class="text-sm text-muted-foreground">
							Showing {offset + 1}-{Math.min(offset + limit, notificationsQuery.data.total)} of {notificationsQuery
								.data.total}
						</div>
						<div class="flex gap-2">
							<Button variant="outline" size="sm" onclick={handlePrevPage} disabled={offset === 0}>
								<ChevronLeftIcon class="mr-1 size-4" />
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={handleNextPage}
								disabled={!notificationsQuery.data.hasMore}
							>
								Next
								<ChevronRightIcon class="ml-1 size-4" />
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</CardContent>
	</Card>
</div>
