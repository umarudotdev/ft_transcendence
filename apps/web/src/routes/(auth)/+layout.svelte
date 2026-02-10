<script lang="ts">
	import ThemeToggle from '$lib/components/theme-toggle.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-md3-surface p-4">
	<!-- Gradient background -->
	<div class="absolute inset-0 bg-gradient-to-br from-md3-surface via-md3-surface to-primary/10 dark:to-primary/5"></div>

	<!-- Grid pattern -->
	<div
		class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
		style="background-image: linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px); background-size: 40px 40px;"
	></div>

	<!-- Radial glow -->
	<div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent dark:from-primary/5"></div>

	<!-- CRT scanlines -->
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
		style="background: repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px);"
	></div>

	<!-- CRT vignette -->
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_transparent_60%,_rgba(0,0,0,0.15)_100%)] dark:bg-[radial-gradient(ellipse_at_center,_transparent_0%,_transparent_60%,_rgba(0,0,0,0.3)_100%)]"></div>

	<div class="absolute top-4 right-4 z-10">
		<ThemeToggle />
	</div>
	<div class="relative z-10 w-full max-w-md">
		{@render children()}
	</div>

	<div class="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-4 text-xs text-muted-foreground">
		<a href="/privacy" class="transition-colors hover:text-foreground">Privacy Policy</a>
		<span>|</span>
		<a href="/terms" class="transition-colors hover:text-foreground">Terms of Service</a>
	</div>
</div>
