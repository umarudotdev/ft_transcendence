<script lang="ts">
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import { createQueryClient } from '$lib/query';
	import { Toaster } from '$lib/components/ui/sonner';
	import '@fontsource/geist-sans';
	import '@fontsource/geist-mono';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const queryClient = createQueryClient();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>

<Toaster position="bottom-right" duration={5000} closeButton />

<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>
			{locale}
		</a>
	{/each}
</div>
