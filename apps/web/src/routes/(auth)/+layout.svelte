<script lang="ts">
	import ThemeToggle from "$lib/components/theme-toggle.svelte";

	let { children } = $props();
</script>

<div class="relative flex min-h-screen items-center justify-center bg-background p-4">
	<div class="absolute right-4 top-4">
		<ThemeToggle />
	</div>
	{@render children()}
</div>
