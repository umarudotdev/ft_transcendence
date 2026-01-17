<script lang="ts">
	import ThemeToggle from '$lib/components/theme-toggle.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-screen items-center justify-center bg-md3-surface p-4">
	<div class="absolute top-4 right-4">
		<ThemeToggle />
	</div>
	{@render children()}
</div>
