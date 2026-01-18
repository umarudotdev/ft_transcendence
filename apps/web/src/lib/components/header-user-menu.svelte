<script lang="ts">
	import { goto } from "$app/navigation";
	import { Button } from "$lib/components/ui/button";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
	import { createLogoutMutation, createMeQuery } from "$lib/queries/auth";
	import { getInitials } from "$lib/utils";
	import UserIcon from "@lucide/svelte/icons/user";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import SettingsIcon from "@lucide/svelte/icons/settings";

	const meQuery = createMeQuery();
	const logoutMutation = createLogoutMutation();

	function handleLogout() {
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				goto("/auth/login");
			},
		});
	}
</script>

{#if meQuery.data}
	{@const user = meQuery.data}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					variant="ghost"
					size="icon"
					class="size-10"
					aria-label="User menu"
					{...props}
				>
					<Avatar class="size-7 ring-2 ring-md3-outline-variant corner-squircle">
						{#if user.avatarUrl}
							<AvatarImage src={user.avatarUrl} alt={user.displayName} />
						{/if}
						<AvatarFallback class="bg-md3-secondary-container text-xs text-md3-on-secondary-container">
							{getInitials(user.displayName)}
						</AvatarFallback>
					</Avatar>
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.Label>
				<div class="flex flex-col space-y-1">
					<p class="text-sm font-medium leading-none">{user.displayName}</p>
					<p class="text-xs leading-none text-muted-foreground">{user.email}</p>
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={() => goto("/profile")}>
				<UserIcon class="mr-2 size-4" />
				Profile
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => goto("/settings")}>
				<SettingsIcon class="mr-2 size-4" />
				Settings
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={handleLogout}>
				<LogOutIcon class="mr-2 size-4" />
				{logoutMutation.isPending ? "Signing out..." : "Sign out"}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<Button variant="ghost" href="/auth/login">
		<UserIcon class="size-5" />
		Sign in
	</Button>
{/if}
