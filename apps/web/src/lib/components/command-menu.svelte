<script lang="ts">
	import * as Command from "$lib/components/ui/command";
	import { Button } from "$lib/components/ui/button";
	import { goto } from "$app/navigation";
	import { setMode, resetMode } from "mode-watcher";
	import { createLogoutMutation } from "$lib/queries/auth";
	import { api } from "$lib/api";

	import SearchIcon from "@lucide/svelte/icons/search";
	import GamepadIcon from "@lucide/svelte/icons/gamepad-2";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import MedalIcon from "@lucide/svelte/icons/medal";
	import BellIcon from "@lucide/svelte/icons/bell";
	import UserIcon from "@lucide/svelte/icons/user";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import KeyIcon from "@lucide/svelte/icons/key-round";
	import SunIcon from "@lucide/svelte/icons/sun";
	import MoonIcon from "@lucide/svelte/icons/moon";
	import MonitorIcon from "@lucide/svelte/icons/monitor";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import LoaderIcon from "@lucide/svelte/icons/loader-circle";

	const logoutMutation = createLogoutMutation();

	let open = $state(false);
	let searchValue = $state("");
	let userResults = $state<Array<{ id: number; displayName: string; avatarUrl: string | null }>>(
		[]
	);
	let isSearching = $state(false);
	let hasSearched = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (searchValue.length < 2) {
			userResults = [];
			hasSearched = false;
			isSearching = false;
			return;
		}

		isSearching = true;
		debounceTimer = setTimeout(async () => {
			const response = await api.api.users.search.get({
				query: { q: searchValue },
				fetch: { credentials: "include" },
			});

			if (!response.error) {
				userResults = response.data.users as Array<{
					id: number;
					displayName: string;
					avatarUrl: string | null;
				}>;
			}
			hasSearched = true;
			isSearching = false;
		}, 200);
	});

	$effect(() => {
		if (!open) {
			searchValue = "";
			userResults = [];
			hasSearched = false;
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			open = !open;
		}
	}

	function navigate(path: string) {
		open = false;
		goto(path);
	}

	function setTheme(theme: "light" | "dark" | "system") {
		open = false;
		if (theme === "system") {
			resetMode();
		} else {
			setMode(theme);
		}
	}

	function handleLogout() {
		open = false;
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				goto("/auth/login");
			},
		});
	}

	function getInitials(name: string): string {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<svelte:document onkeydown={handleKeydown} />

<Button
	variant="outline"
	size="sm"
	class="gap-2 text-muted-foreground"
	onclick={() => (open = true)}
>
	<SearchIcon class="size-4" />
	<span class="hidden sm:inline-flex">Search...</span>
	<kbd
		class="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex"
	>
		<span class="text-xs">⌘</span>K
	</kbd>
</Button>

<Command.Dialog bind:open>
	<Command.Input placeholder="Type a command or search users..." bind:value={searchValue} />
	<Command.List>
		{#if !isSearching && !hasSearched}
			<Command.Empty>No results found.</Command.Empty>
		{/if}
		{#if isSearching || hasSearched}
			<Command.Group heading="Users" forceMount>
				{#if isSearching}
					<div class="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
						<LoaderIcon class="size-4 animate-spin" />
						<span>Searching users...</span>
					</div>
				{:else if userResults.length === 0}
					<div class="px-2 py-3 text-sm text-muted-foreground">
						No users found for "{searchValue}"
					</div>
				{:else}
					{#each userResults as user (user.id)}
						<Command.Item
							onSelect={() => navigate(`/users/${user.id}`)}
							value={`user-${user.id}-${user.displayName}`}
							forceMount
						>
							{#if user.avatarUrl}
								<img
									src={user.avatarUrl}
									alt={user.displayName}
									class="size-5 rounded-full object-cover"
								/>
							{:else}
								<div
									class="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
								>
									{getInitials(user.displayName)}
								</div>
							{/if}
							<span>{user.displayName}</span>
						</Command.Item>
					{/each}
				{/if}
			</Command.Group>
			<Command.Separator />
		{/if}
		<Command.Group heading="Navigation">
			<Command.Item onSelect={() => navigate("/")}>
				<GamepadIcon />
				<span>Game Lobby</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate("/leaderboard")}>
				<TrophyIcon />
				<span>Leaderboard</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate("/achievements")}>
				<MedalIcon />
				<span>Achievements</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate("/notifications")}>
				<BellIcon />
				<span>Notifications</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate("/profile")}>
				<UserIcon />
				<span>Profile</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading="Settings">
			<Command.Item onSelect={() => navigate("/settings")}>
				<SettingsIcon />
				<span>Account</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate("/settings/security")}>
				<ShieldIcon />
				<span>Security</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate("/settings/2fa")}>
				<KeyIcon />
				<span>Two-Factor Auth</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading="Theme">
			<Command.Item onSelect={() => setTheme("light")}>
				<SunIcon />
				<span>Light</span>
			</Command.Item>
			<Command.Item onSelect={() => setTheme("dark")}>
				<MoonIcon />
				<span>Dark</span>
			</Command.Item>
			<Command.Item onSelect={() => setTheme("system")}>
				<MonitorIcon />
				<span>System</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading="Account">
			<Command.Item onSelect={handleLogout}>
				<LogOutIcon />
				<span>Sign Out</span>
			</Command.Item>
		</Command.Group>
	</Command.List>
</Command.Dialog>
