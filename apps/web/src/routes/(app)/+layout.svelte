<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar";
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import { NotificationBell } from "$lib/components/notifications";
	import CommandMenu from "$lib/components/command-menu.svelte";
	import HeaderUserMenu from "$lib/components/header-user-menu.svelte";

	let { children } = $props();
</script>

<Sidebar.Provider open={false}>
	<AppSidebar />
	<Sidebar.Inset>
		<header
			class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 bg-md3-surface-container px-4 shadow-sm"
		>
			<!-- Search (left) -->
			<CommandMenu />

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Actions (right) -->
			<div class="flex items-center gap-1">
				<NotificationBell />
				<div class="ml-2 h-8 w-px bg-md3-outline-variant"></div>
				<HeaderUserMenu />
			</div>
		</header>
		<main class="flex-1 overflow-auto p-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
