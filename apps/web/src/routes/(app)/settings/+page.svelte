<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { createLogoutMutation, createMeQuery } from '$lib/queries/auth';
	import { getInitials } from '$lib/utils';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';

	const meQuery = createMeQuery();
	const logoutMutation = createLogoutMutation();

	function handleLogout() {
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				goto('/auth/login');
			}
		});
	}
</script>

<svelte:head>
	<title>{m.settings_title()} | ft_transcendence</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m.settings_title()}</h1>
		<p class="text-muted-foreground">{m.settings_subtitle()}</p>
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
					{m.settings_login_required()}
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
									{m.common_verified()}
								</Badge>
							{:else}
								<Badge
									variant="secondary"
									class="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
								>
									{m.common_unverified()}
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
						<h3 class="font-medium">{m.settings_security()}</h3>
						<p class="text-sm text-muted-foreground">{m.settings_security_description()}</p>
					</div>
				</div>
				<ChevronRightIcon class="size-5 text-muted-foreground" />
			</a>

			<!-- Language Settings -->
			<div class="rounded-lg border bg-card p-4">
				<div class="flex items-center gap-4">
					<div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
						<GlobeIcon class="size-5 text-primary" />
					</div>
					<div class="flex-1">
						<h3 class="font-medium">{m.settings_language()}</h3>
						<p class="text-sm text-muted-foreground">{m.settings_language_description()}</p>
					</div>
				</div>
				<div class="mt-3 flex gap-2 pl-14">
					{#each [{ code: 'en' as const, label: 'English' }, { code: 'pt-br' as const, label: 'Português (BR)' }, { code: 'es' as const, label: 'Español' }] as lang}
						<Button
							variant={getLocale() === lang.code ? 'default' : 'outline'}
							size="sm"
							onclick={() => setLocale(lang.code)}
							class="gap-1"
						>
							{#if getLocale() === lang.code}
								<CheckIcon class="size-3" />
							{/if}
							{lang.label}
						</Button>
					{/each}
				</div>
			</div>
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
				{logoutMutation.isPending ? m.settings_signing_out() : m.settings_sign_out()}
			</Button>
		</div>
	{/if}
</div>
