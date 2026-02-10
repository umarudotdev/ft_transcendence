<script lang="ts">
	import ThemeToggle from '$lib/components/theme-toggle.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-screen flex-col bg-md3-surface">
	<div class="absolute inset-0 bg-gradient-to-br from-md3-surface via-md3-surface to-primary/10 dark:to-primary/5"></div>

	<div
		class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
		style="background-image: linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px); background-size: 40px 40px;"
	></div>

	<div class="absolute top-4 right-4 z-10">
		<ThemeToggle />
	</div>

	<div class="relative z-10 flex-1">
		{@render children()}
	</div>

	<footer class="relative z-10 border-t border-md3-outline-variant/20 py-6">
		<div class="container mx-auto max-w-4xl px-4">
			<div class="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
				<div class="flex items-center gap-4">
					<a href="/privacy" class="transition-colors hover:text-foreground">Privacy Policy</a>
					<span>|</span>
					<a href="/terms" class="transition-colors hover:text-foreground">Terms of Service</a>
					<span>|</span>
					<a href="/auth/login" class="transition-colors hover:text-foreground">Back to Login</a>
				</div>
				<p>&copy; {new Date().getFullYear()} ft_transcendence. All rights reserved.</p>
			</div>
		</div>
	</footer>
</div>
