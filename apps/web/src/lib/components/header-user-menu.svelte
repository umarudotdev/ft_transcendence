<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { createLogoutMutation, createMeQuery } from '$lib/queries/auth';
	import { getInitials } from '$lib/utils';
	import UserIcon from '@lucide/svelte/icons/user';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { m } from '$lib/paraglide/messages.js';

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

{#if meQuery.data}
	{@const user = meQuery.data}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" class="size-10" aria-label={m.header_user_menu()} {...props}>
					<Avatar class="corner-squircle size-7 ring-2 ring-md3-outline-variant">
						{#if user.avatarUrl}
							<AvatarImage src={user.avatarUrl} alt={user.displayName} />
						{/if}
						<AvatarFallback
							class="bg-md3-secondary-container text-xs text-md3-on-secondary-container"
						>
							{getInitials(user.displayName)}
						</AvatarFallback>
					</Avatar>
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.Label>
				<div class="flex flex-col space-y-1">
					<p class="text-sm leading-none font-medium">{user.displayName}</p>
					<p class="text-xs leading-none text-muted-foreground">{user.email}</p>
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={() => goto('/profile')}>
				<UserIcon class="mr-2 size-4" />
				{m.nav_profile()}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => goto('/settings')}>
				<SettingsIcon class="mr-2 size-4" />
				{m.nav_settings()}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={handleLogout}>
				<LogOutIcon class="mr-2 size-4" />
				{logoutMutation.isPending ? m.header_signing_out() : m.common_sign_out()}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<Button variant="ghost" href="/auth/login">
		<UserIcon class="size-5" />
		{m.common_sign_in()}
	</Button>
{/if}
