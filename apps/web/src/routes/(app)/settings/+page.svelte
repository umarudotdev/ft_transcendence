<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { createLogoutMutation, createMeQuery } from '$lib/queries/auth';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LogOutIcon from '@lucide/svelte/icons/log-out';

	const meQuery = createMeQuery();
	const logoutMutation = createLogoutMutation();

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	async function handleLogout() {
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				goto('/auth/login');
			}
		});
	}
</script>

<svelte:head>
	<title>Settings | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Settings</h1>
		<p class="text-muted-foreground">Manage your account preferences and security</p>
	</div>

	{#if meQuery.isPending}
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center gap-4">
					<Skeleton class="size-16 rounded-full" />
					<div class="space-y-2">
						<Skeleton class="h-5 w-32" />
						<Skeleton class="h-4 w-48" />
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{:else if meQuery.error}
		<Card.Root>
			<Card.Content class="p-6 text-center">
				<p class="text-muted-foreground">
					Please <a href="/auth/login" class="font-medium text-primary underline">log in</a> to access
					settings.
				</p>
			</Card.Content>
		</Card.Root>
	{:else if meQuery.data}
		{@const user = meQuery.data}

		<!-- User Info Card -->
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center gap-4">
					<Avatar class="size-16">
						{#if user.avatarUrl}
							<AvatarImage src={user.avatarUrl} alt={user.displayName} />
						{/if}
						<AvatarFallback class="text-lg">{getInitials(user.displayName)}</AvatarFallback>
					</Avatar>
					<div class="flex-1">
						<h2 class="text-lg font-medium">{user.displayName}</h2>
						<p class="text-sm text-muted-foreground">{user.email}</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#if user.emailVerified}
								<Badge
									variant="secondary"
									class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
								>
									Verified
								</Badge>
							{:else}
								<Badge
									variant="secondary"
									class="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
								>
									Unverified
								</Badge>
							{/if}
							{#if user.twoFactorEnabled}
								<Badge
									variant="secondary"
									class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
								>
									2FA
								</Badge>
							{/if}
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Settings Navigation -->
		<div class="space-y-2">
			<a
				href="/settings/security"
				class="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
			>
				<div class="flex items-center gap-4">
					<div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
						<ShieldIcon class="size-5 text-primary" />
					</div>
					<div>
						<h3 class="font-medium">Security</h3>
						<p class="text-sm text-muted-foreground">Password, 2FA, and connected accounts</p>
					</div>
				</div>
				<ChevronRightIcon class="size-5 text-muted-foreground" />
			</a>
		</div>

		<!-- Logout -->
		<div class="pt-4">
			<Button
				variant="outline"
				class="w-full"
				onclick={handleLogout}
				disabled={logoutMutation.isPending}
			>
				<LogOutIcon class="mr-2 size-4" />
				{logoutMutation.isPending ? 'Signing out...' : 'Sign Out'}
			</Button>
		</div>
	{/if}
</div>
