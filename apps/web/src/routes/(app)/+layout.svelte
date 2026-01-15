<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar";
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import ThemeToggle from "$lib/components/theme-toggle.svelte";
	import { NotificationBell } from "$lib/components/notifications";

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ml-1"></Sidebar.Trigger>
			<div class="h-4 w-px bg-border"></div>
			<span class="flex-1 text-sm font-medium text-muted-foreground">ft_transcendence</span>
			<NotificationBell />
			<ThemeToggle />
		</header>
		<main class="flex-1 overflow-auto p-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
