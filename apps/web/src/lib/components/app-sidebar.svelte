<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
	import { createLogoutMutation, createMeQuery } from "$lib/queries/auth";
	import GamepadIcon from "@lucide/svelte/icons/gamepad-2";
	import UserIcon from "@lucide/svelte/icons/user";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import MedalIcon from "@lucide/svelte/icons/medal";
	import BellIcon from "@lucide/svelte/icons/bell";
	import ShieldIcon from "@lucide/svelte/icons/shield";

	const meQuery = createMeQuery();
	const logoutMutation = createLogoutMutation();

	const currentPath = $derived($page.url.pathname);

	const navItems = [
		{ href: "/", label: "Game Lobby", icon: GamepadIcon },
		{ href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
		{ href: "/achievements", label: "Achievements", icon: MedalIcon },
		{ href: "/notifications", label: "Notifications", icon: BellIcon },
		{ href: "/profile", label: "Profile", icon: UserIcon },
	];

	const settingsItems = [
		{ href: "/settings", label: "Account" },
		{ href: "/settings/security", label: "Security" },
		{ href: "/settings/2fa", label: "Two-Factor Auth" },
	];

	const isSettingsActive = $derived(currentPath.startsWith("/settings"));
	const isAdminActive = $derived(currentPath.startsWith("/admin"));
	const isAdmin = $derived(
		meQuery.data?.role === "admin" || meQuery.data?.role === "moderator"
	);
	let settingsOpen = $state(false);
	let adminOpen = $state(false);

	const adminItems = [
		{ href: "/admin", label: "Dashboard" },
		{ href: "/admin/users", label: "Users" },
		{ href: "/admin/reports", label: "Reports" },
		{ href: "/admin/sanctions", label: "Sanctions" },
		{ href: "/admin/audit", label: "Audit Log" },
	];

	// Keep settings open if we're on a settings page
	$effect(() => {
		if (isSettingsActive) {
			settingsOpen = true;
		}
	});

	// Keep admin menu open if we're on an admin page
	$effect(() => {
		if (isAdminActive) {
			adminOpen = true;
		}
	});

	function isActive(href: string): boolean {
		if (href === "/") {
			return currentPath === "/";
		}
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	function getInitials(name: string): string {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}

	async function handleLogout() {
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				goto("/auth/login");
			},
		});
	}
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header class="border-b p-4">
		<div class="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
			<GamepadIcon class="size-6 shrink-0" />
			<span class="font-semibold group-data-[collapsible=icon]:hidden">ft_transcendence</span>
		</div>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navItems as item}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isActive(item.href)} tooltipContent={item.label}>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon class="size-4" />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}

					<Collapsible.Root bind:open={settingsOpen} class="group/collapsible">
						<Sidebar.MenuItem>
							<Collapsible.Trigger class="w-full">
								<Sidebar.MenuButton isActive={isSettingsActive} tooltipContent="Settings">
									<SettingsIcon class="size-4" />
									<span>Settings</span>
									<ChevronDownIcon class="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
								</Sidebar.MenuButton>
							</Collapsible.Trigger>
							<Collapsible.Content>
								<Sidebar.MenuSub>
									{#each settingsItems as item}
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubButton isActive={currentPath === item.href}>
												{#snippet child({ props })}
													<a href={item.href} {...props}>
														<span>{item.label}</span>
													</a>
												{/snippet}
											</Sidebar.MenuSubButton>
										</Sidebar.MenuSubItem>
									{/each}
								</Sidebar.MenuSub>
							</Collapsible.Content>
						</Sidebar.MenuItem>
					</Collapsible.Root>

					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={isActive("/status")} tooltipContent="System Status">
							{#snippet child({ props })}
								<a href="/status" {...props}>
									<ActivityIcon class="size-4" />
									<span>System Status</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>

					{#if isAdmin}
						<Collapsible.Root bind:open={adminOpen} class="group/collapsible">
							<Sidebar.MenuItem>
								<Collapsible.Trigger class="w-full">
									<Sidebar.MenuButton isActive={isAdminActive} tooltipContent="Admin Panel">
										<ShieldIcon class="size-4" />
										<span>Admin</span>
										<ChevronDownIcon class="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
									</Sidebar.MenuButton>
								</Collapsible.Trigger>
								<Collapsible.Content>
									<Sidebar.MenuSub>
										{#each adminItems as item}
											<Sidebar.MenuSubItem>
												<Sidebar.MenuSubButton isActive={currentPath === item.href}>
													{#snippet child({ props })}
														<a href={item.href} {...props}>
															<span>{item.label}</span>
														</a>
													{/snippet}
												</Sidebar.MenuSubButton>
											</Sidebar.MenuSubItem>
										{/each}
									</Sidebar.MenuSub>
								</Collapsible.Content>
							</Sidebar.MenuItem>
						</Collapsible.Root>
					{/if}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t p-2">
		{#if meQuery.data}
			{@const user = meQuery.data}
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton size="lg" tooltipContent={user.displayName}>
						{#snippet child({ props })}
							<a href="/profile" {...props}>
								<Avatar class="size-8">
									{#if user.avatarUrl}
										<AvatarImage src={user.avatarUrl} alt={user.displayName} />
									{/if}
									<AvatarFallback class="text-xs">{getInitials(user.displayName)}</AvatarFallback>
								</Avatar>
								<div class="flex flex-col items-start overflow-hidden">
									<span class="truncate font-medium">{user.displayName}</span>
									<span class="truncate text-xs text-muted-foreground">{user.email}</span>
								</div>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Sign Out" onclick={handleLogout}>
						<LogOutIcon class="size-4" />
						<span>{logoutMutation.isPending ? "Signing out..." : "Sign Out"}</span>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		{:else}
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton tooltipContent="Sign In">
						{#snippet child({ props })}
							<a href="/auth/login" {...props}>
								<UserIcon class="size-4" />
								<span>Sign In</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		{/if}
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
