<script lang="ts">
	import * as Command from '$lib/components/ui/command';
	import * as Kbd from '$lib/components/ui/kbd';
	import { goto } from '$app/navigation';
	import { setMode, resetMode } from 'mode-watcher';
	import { createLogoutMutation } from '$lib/queries/auth';
	import { api } from '$lib/api';
	import { getInitials } from '$lib/utils';
	import { m } from '$lib/paraglide/messages.js';

	import SearchIcon from '@lucide/svelte/icons/search';
	import GamepadIcon from '@lucide/svelte/icons/gamepad-2';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import MedalIcon from '@lucide/svelte/icons/medal';
	import BellIcon from '@lucide/svelte/icons/bell';
	import UserIcon from '@lucide/svelte/icons/user';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import KeyIcon from '@lucide/svelte/icons/key-round';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';

	const logoutMutation = createLogoutMutation();

	let open = $state(false);
	let searchValue = $state('');
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
				fetch: { credentials: 'include' }
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
			searchValue = '';
			userResults = [];
			hasSearched = false;
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			open = !open;
		}
	}

	function navigate(path: string) {
		open = false;
		goto(path);
	}

	function setTheme(theme: 'light' | 'dark' | 'system') {
		open = false;
		if (theme === 'system') {
			resetMode();
		} else {
			setMode(theme);
		}
	}

	function handleLogout() {
		open = false;
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				goto('/auth/login');
			}
		});
	}
</script>

<svelte:document onkeydown={handleKeydown} />

<button
	onclick={() => (open = true)}
	class="flex h-10 w-full max-w-md items-center gap-3 rounded-full bg-md3-surface-container-highest px-4 text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-high"
>
	<SearchIcon class="size-5 shrink-0" />
	<span class="flex-1 text-left text-sm">{m.common_search()}</span>
	<Kbd.Group class="hidden sm:inline-flex">
		<Kbd.Root>Ctrl</Kbd.Root>
		<Kbd.Root>K</Kbd.Root>
	</Kbd.Group>
</button>

<Command.Dialog bind:open>
	<Command.Input placeholder={m.command_search_placeholder()} bind:value={searchValue} />
	<Command.List>
		{#if !isSearching && !hasSearched}
			<Command.Empty>{m.common_no_results()}</Command.Empty>
		{/if}
		{#if isSearching || hasSearched}
			<Command.Group heading={m.command_users()} forceMount>
				{#if isSearching}
					<div class="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
						<LoaderIcon class="size-4 animate-spin" />
						<span>{m.command_searching()}</span>
					</div>
				{:else if userResults.length === 0}
					<div class="px-2 py-3 text-sm text-muted-foreground">
						{m.command_no_users({ query: searchValue })}
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
		<Command.Group heading={m.command_navigation()}>
			<Command.Item onSelect={() => navigate('/')}>
				<GamepadIcon />
				<span>{m.nav_game_lobby()}</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate('/leaderboard')}>
				<TrophyIcon />
				<span>{m.nav_leaderboard()}</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate('/achievements')}>
				<MedalIcon />
				<span>{m.nav_achievements()}</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate('/notifications')}>
				<BellIcon />
				<span>{m.nav_notifications()}</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate('/profile')}>
				<UserIcon />
				<span>{m.nav_profile()}</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading={m.command_settings()}>
			<Command.Item onSelect={() => navigate('/settings')}>
				<SettingsIcon />
				<span>{m.command_account()}</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate('/settings/security')}>
				<ShieldIcon />
				<span>{m.command_security()}</span>
			</Command.Item>
			<Command.Item onSelect={() => navigate('/settings/2fa')}>
				<KeyIcon />
				<span>{m.command_two_factor()}</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading={m.command_theme()}>
			<Command.Item onSelect={() => setTheme('light')}>
				<SunIcon />
				<span>{m.theme_light()}</span>
			</Command.Item>
			<Command.Item onSelect={() => setTheme('dark')}>
				<MoonIcon />
				<span>{m.theme_dark()}</span>
			</Command.Item>
			<Command.Item onSelect={() => setTheme('system')}>
				<MonitorIcon />
				<span>{m.theme_system()}</span>
			</Command.Item>
		</Command.Group>
		<Command.Separator />
		<Command.Group heading={m.command_account()}>
			<Command.Item onSelect={handleLogout}>
				<LogOutIcon />
				<span>{m.command_sign_out()}</span>
			</Command.Item>
		</Command.Group>
	</Command.List>
</Command.Dialog>
