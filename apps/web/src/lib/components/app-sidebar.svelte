<script lang="ts">
	import { page } from "$app/stores";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { Button } from "$lib/components/ui/button";
	import ThemeToggle from "$lib/components/theme-toggle.svelte";
	import { createMeQuery } from "$lib/queries/auth";
	import PlayIcon from "@lucide/svelte/icons/play";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import UsersIcon from "@lucide/svelte/icons/users";
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import UserIcon from "@lucide/svelte/icons/user";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ShieldIcon from "@lucide/svelte/icons/shield";

	const meQuery = createMeQuery();

	const currentPath = $derived($page.url.pathname);

	const navItems = [
		{ href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
		{ href: "/friends", label: "Friends", icon: UsersIcon },
		{ href: "/chat", label: "Chat", icon: MessageSquareIcon },
		{ href: "/profile", label: "Profile", icon: UserIcon },
		{ href: "/settings", label: "Settings", icon: SettingsIcon },
	];

	const isAdmin = $derived(
		meQuery.data?.role === "admin" || meQuery.data?.role === "moderator"
	);

	function isActive(href: string): boolean {
		if (href === "/") {
			return currentPath === "/";
		}
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}
</script>

<Sidebar.Root collapsible="icon">
	<!-- FAB Section -->
	<Sidebar.Header class="flex items-center justify-center p-4">
		<Button
			href="/"
			size="icon-lg"
			class="size-14 rounded-2xl bg-md3-primary text-md3-on-primary shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
		>
			<PlayIcon class="size-7" />
			<span class="sr-only">Play</span>
		</Button>
	</Sidebar.Header>

	<!-- Navigation Items -->
	<Sidebar.Content class="flex flex-col items-center py-6">
		<Sidebar.Group class="w-full px-3">
			<Sidebar.GroupContent>
				<Sidebar.Menu class="flex flex-col items-center gap-3">
					{#each navItems as item}
						{@const active = isActive(item.href)}
						<Sidebar.MenuItem class="w-full">
							<Sidebar.MenuButton
								isActive={active}
								tooltipContent={item.label}
								class="mx-auto flex size-12 items-center justify-center rounded-2xl transition-all duration-200 {active
									? 'bg-md3-secondary-container text-md3-on-secondary-container shadow-sm'
									: 'text-md3-on-surface-variant hover:bg-md3-surface-container-highest hover:text-md3-on-surface'}"
							>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon class="size-6" />
										<span class="sr-only">{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}

					<!-- Admin Link (conditional) -->
					{#if isAdmin}
						{@const adminActive = isActive("/admin")}
						<Sidebar.MenuItem class="w-full">
							<Sidebar.MenuButton
								isActive={adminActive}
								tooltipContent="Admin Panel"
								class="mx-auto flex size-12 items-center justify-center rounded-2xl transition-all duration-200 {adminActive
									? 'bg-md3-tertiary-container text-md3-on-tertiary-container shadow-sm'
									: 'text-md3-on-surface-variant hover:bg-md3-surface-container-highest hover:text-md3-on-surface'}"
							>
								{#snippet child({ props })}
									<a href="/admin" {...props}>
										<ShieldIcon class="size-6" />
										<span class="sr-only">Admin Panel</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/if}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<!-- Footer with Theme Toggle -->
	<Sidebar.Footer class="flex items-center justify-center p-4">
		<ThemeToggle />
	</Sidebar.Footer>
</Sidebar.Root>
